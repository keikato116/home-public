import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// グループの解散。招待した側・された側のどちらからでも実行できる。
//
// 解散すると、あとから参加した人が世帯から抜ける。世帯とそのデータは
// 世帯を作った人に残り、抜けた人は次回起動時に初期設定からやり直す（= 1人用で作り直す）。
// どちらが押しても結果が同じなので、「先に押したほうがデータを持っていく」
// 早い者勝ちにならない。
//
// カレンダーが見えなくなるのは household_members を消すだけでは不十分。
// /api/partner-calendar は service role で user_tokens を household_id で引くので、
// 抜けた人の user_tokens が古い世帯を指したままだと、残った側からはまだ相手の
// カレンダーが見えてしまう。ここで household_id と Google トークンごと消す。

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
  const householdId = membership.household_id as string;

  const { data: members } = await admin
    .from("household_members")
    .select("user_id, joined_at")
    .eq("household_id", householdId)
    .order("joined_at", { ascending: true });

  const rows = members ?? [];
  if (rows.length <= 1) {
    return NextResponse.json({ error: "already solo" }, { status: 400 });
  }

  // 先頭 = 世帯を作った人。残るのはこの人。
  const ownerId = rows[0].user_id as string;
  const leaving = rows.filter((m) => m.user_id !== ownerId).map((m) => m.user_id as string);

  const { error: memberError } = await admin
    .from("household_members")
    .delete()
    .eq("household_id", householdId)
    .in("user_id", leaving);
  if (memberError) {
    return NextResponse.json({ error: memberError.message }, { status: 500 });
  }

  // 抜けた人のカレンダーを、残った側から引けないようにする。
  const { error: tokenError } = await admin
    .from("user_tokens")
    .update({
      household_id: null,
      google_access_token: "",
      google_refresh_token: "",
      updated_at: new Date().toISOString(),
    })
    .in("user_id", leaving);
  if (tokenError) {
    return NextResponse.json({ error: tokenError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, left: leaving.includes(user.id) });
}
