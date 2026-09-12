import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { transferHouseholdData } from "@/lib/server/householdTransfer";

// グループの解散。招待した側・された側のどちらからでも実行できる。
//
// 押した人によらず、あとから参加した人が抜ける。共有していたデータ（2人で使っていた
// 買い物リスト・やること・レシピ・献立）は世帯を作った人に残る。結果が押した人に
// 依存しないので、「先に押したほうがデータを持っていく」早い者勝ちにならない。
//
// 抜ける人には新しい1人用の世帯をここで作り、暮らしの土台になるものを持たせる。
//   移す  : 自分にしか見えない買い物アイテム（置いていくと本人からも見えなくなる）
//   複製  : レシピ・家事ルーティン・やること・献立（2人で作ったものなので両方が持つ）
//   残す  : 割り勘・共有の買い物リスト（相手との記録。部屋が変わるので表示もされない）
//
// カレンダーが見えなくなるのは household_members を消すだけでは不十分。
// /api/partner-calendar は service role で user_tokens を household_id で引くので、
// 抜けた人の user_tokens を新しい世帯に付け替えて、古い世帯から引けないようにする。

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY not configured" }, { status: 503 });
  }

  const { data: membership } = await admin
    .from("household_members")
    .select("household_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership?.household_id) {
    return NextResponse.json({ error: "not in a household" }, { status: 400 });
  }
  const oldHouseholdId = membership.household_id as string;

  const { data: members } = await admin
    .from("household_members")
    .select("user_id, joined_at")
    .eq("household_id", oldHouseholdId)
    .order("joined_at", { ascending: true });

  const rows = members ?? [];
  if (rows.length <= 1) {
    return NextResponse.json({ error: "already solo" }, { status: 400 });
  }

  // 先頭 = 世帯を作った人。共有データはこの人に残る。
  const ownerId = rows[0].user_id as string;
  const leaving = rows.filter((m) => m.user_id !== ownerId).map((m) => m.user_id as string);

  for (const leaverId of leaving) {
    const { data: household, error: createError } = await admin
      .from("households")
      .insert({ name: "my home" })
      .select()
      .single();
    if (createError || !household) {
      return NextResponse.json({ error: createError?.message ?? "failed to create household" }, { status: 500 });
    }
    const newHouseholdId = household.id as string;

    await admin.from("calendar_settings").insert({
      household_id: newHouseholdId,
      selected_colors: [],
      start_date: new Date().toISOString().split("T")[0],
    });

    // 世帯の移動は「抜けてから入る」順で行う。逆にすると一瞬2世帯に所属し、
    // 所属世帯を maybeSingle() で引いている箇所が複数行エラーになる。
    const { error: leaveError } = await admin
      .from("household_members")
      .delete()
      .eq("household_id", oldHouseholdId)
      .eq("user_id", leaverId);
    if (leaveError) {
      return NextResponse.json({ error: leaveError.message }, { status: 500 });
    }

    const { error: joinError } = await admin
      .from("household_members")
      .insert({ household_id: newHouseholdId, user_id: leaverId });
    if (joinError) {
      return NextResponse.json({ error: joinError.message }, { status: 500 });
    }

    // レシピ・家事・やること・献立を複製し、自分専用の買い物アイテムを移す。
    // 参加（/api/household/join）と同じ処理を使っている。
    const copyError = await transferHouseholdData(admin, oldHouseholdId, newHouseholdId, leaverId);
    if (copyError) {
      return NextResponse.json({ error: copyError }, { status: 500 });
    }

    // Google の鍵を新しい世帯に付け替える。これをしないと、残った側からは
    // 抜けた人のカレンダーが見えたままになる。
    const { error: tokenError } = await admin
      .from("user_tokens")
      .update({ household_id: newHouseholdId, updated_at: new Date().toISOString() })
      .eq("user_id", leaverId);
    if (tokenError) {
      return NextResponse.json({ error: tokenError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, left: leaving.includes(user.id) });
}
