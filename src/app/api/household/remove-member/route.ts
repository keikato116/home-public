import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// ペア → ソロ に戻すための「パートナーを世帯から外す」。
//
// household_members には delete ポリシーがない（クライアントからは誰も消せない）ので、
// 本人確認をしたうえで service role で消す。
//
// 外せるのは世帯を作った人（最初に join した人）だけ。どちらからでも相手を追い出せると、
// 相手のデータを一方的に見られなくする操作が誰にでもできてしまう。
// 抜ける側は自分自身を指定して抜けられる。

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let targetUserId: string;
  try {
    const body = await req.json();
    targetUserId = String(body?.userId ?? "");
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  if (!targetUserId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
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

  const { data: members } = await admin
    .from("household_members")
    .select("user_id, joined_at")
    .eq("household_id", membership.household_id)
    .order("joined_at", { ascending: true });

  const rows = members ?? [];
  if (!rows.some((m) => m.user_id === targetUserId)) {
    return NextResponse.json({ error: "target is not in this household" }, { status: 404 });
  }

  const isOwner = rows[0]?.user_id === user.id;
  if (targetUserId !== user.id && !isOwner) {
    return NextResponse.json({ error: "only the household owner can remove a partner" }, { status: 403 });
  }

  // 世帯が空になる操作は受け付けない。データが宙に浮くだけなので、
  // 本当にやめたいならアカウント削除（DELETE /api/account）を使ってもらう。
  if (rows.length <= 1) {
    return NextResponse.json({ error: "cannot leave a household with no other members" }, { status: 400 });
  }

  const { error } = await admin
    .from("household_members")
    .delete()
    .eq("household_id", membership.household_id)
    .eq("user_id", targetUserId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
