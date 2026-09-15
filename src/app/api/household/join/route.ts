import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { transferHouseholdData } from "@/lib/server/householdTransfer";

// 招待コードで世帯に参加する。
//
// 2通りある。
//   ・まだ世帯が無い人（登録直後）→ そのまま入る
//   ・すでに1人で使っている人      → いまの世帯を畳んで移る
//
// 後者が無いと、2人ともそれぞれ世帯を作ってしまった時点で合流できなくなる。
// 招待コードを入れる画面は「世帯を持っていない人」にしか出ないため、
// 設定から呼べるようにしてある。
//
// 移るときは、レシピ・家事・やること・献立を複製して持っていく。
// 解散のときと同じ振る舞いで、1人で使い込んだ分が消えたように見えるのを避ける。
//
// メンバーの削除はクライアントからはできない（household_members に delete の
// ポリシーが無い）ので、ここは service role で行う。

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { invite_code } = await request.json();
  if (!invite_code) {
    return NextResponse.json({ error: "invite_code required" }, { status: 400 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY not configured" }, { status: 503 });
  }

  const code = String(invite_code).trim().toUpperCase();

  const { data: target } = await admin
    .from("households")
    .select("id")
    .eq("invite_code", code)
    .maybeSingle();

  if (!target) {
    return NextResponse.json({ error: "invite code not found" }, { status: 404 });
  }
  const targetId = target.id as string;

  // いまの所属を調べる
  const { data: current } = await admin
    .from("household_members")
    .select("household_id")
    .eq("user_id", user.id)
    .maybeSingle();
  const currentId = (current?.household_id as string | undefined) ?? null;

  if (currentId === targetId) {
    return NextResponse.json({ ok: true, household_id: targetId, moved: false });
  }

  // 相手の世帯がすでに2人なら入れない。3人は想定していない
  // （割り勘が him / her の2人前提で、誰の分か決められなくなる）
  const { data: targetMembers } = await admin
    .from("household_members")
    .select("user_id")
    .eq("household_id", targetId);
  if ((targetMembers ?? []).length >= 2) {
    return NextResponse.json({ error: "household is full" }, { status: 409 });
  }

  // まだ世帯が無い人はそのまま入れる
  if (!currentId) {
    const { error } = await admin
      .from("household_members")
      .insert({ household_id: targetId, user_id: user.id });
    if (error && !error.message.includes("duplicate")) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    await admin
      .from("user_tokens")
      .update({ household_id: targetId, updated_at: new Date().toISOString() })
      .eq("user_id", user.id);
    // 名前と色も同じ世帯を指していないと、移った先で相手に名前が出ない。
    await admin
      .from("member_profiles")
      .update({ household_id: targetId, updated_at: new Date().toISOString() })
      .eq("user_id", user.id);
    return NextResponse.json({ ok: true, household_id: targetId, moved: false });
  }

  // すでに誰かと使っている世帯からは移れない。先に解散してもらう。
  // 黙って抜けると、相手には理由の分からないまま1人に戻る。
  const { data: currentMembers } = await admin
    .from("household_members")
    .select("user_id")
    .eq("household_id", currentId);
  if ((currentMembers ?? []).length >= 2) {
    return NextResponse.json({ error: "leave your current household first" }, { status: 409 });
  }

  // --- ここから、1人用の世帯を畳んで移る ---

  // 先に複製する。移ってから失敗すると、古い世帯に戻る手段が無くなる。
  const copyError = await transferHouseholdData(admin, currentId, targetId, user.id);
  if (copyError) {
    return NextResponse.json({ error: copyError }, { status: 500 });
  }

  // 所属の付け替えは「抜けてから入る」順で。逆にすると一瞬2世帯に所属し、
  // 所属を maybeSingle() で引いている箇所が複数行エラーになる。
  const { error: leaveError } = await admin
    .from("household_members")
    .delete()
    .eq("household_id", currentId)
    .eq("user_id", user.id);
  if (leaveError) {
    return NextResponse.json({ error: leaveError.message }, { status: 500 });
  }

  const { error: joinError } = await admin
    .from("household_members")
    .insert({ household_id: targetId, user_id: user.id });
  if (joinError) {
    return NextResponse.json({ error: joinError.message }, { status: 500 });
  }

  // Google の鍵を新しい世帯に付け替える。これをしないと
  // /api/partner-calendar が古い世帯を見たままになる。
  await admin
    .from("user_tokens")
    .update({ household_id: targetId, updated_at: new Date().toISOString() })
    .eq("user_id", user.id);
  await admin
    .from("member_profiles")
    .update({ household_id: targetId, updated_at: new Date().toISOString() })
    .eq("user_id", user.id);

  // 空になった元の世帯を消す。誰にも見えないまま残り続けるのを防ぐ。
  // 持っていくものは上で複製済みで、残るのは割り勘など
  // 1人では意味を持たない記録だけ。
  await admin.from("households").delete().eq("id", currentId);

  return NextResponse.json({ ok: true, household_id: targetId, moved: true });
}
