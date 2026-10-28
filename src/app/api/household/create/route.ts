import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// 初回登録で世帯を作る。
//
// 以前はクライアントが households と household_members に直接 insert していたが、
// そのためのポリシーが「だれでも全世帯を読める・どの世帯にも入れる」穴になっていた
// （supabase/migrations/2026-10-21_close_household_join.sql）。作成はここで
// service role で行い、クライアントからの insert は許さない。

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY not configured" }, { status: 503 });
  }

  const body = (await request.json().catch(() => ({}))) as { pair?: boolean };

  // 二重送信やリロードで2つ目の世帯を作らない。すでに所属していればそれを返す。
  const { data: existing } = await admin
    .from("household_members")
    .select("household_id, households(invite_code)")
    .eq("user_id", user.id)
    .maybeSingle();
  if (existing?.household_id) {
    const embedded = existing.households as { invite_code?: string } | { invite_code?: string }[] | null;
    const code = Array.isArray(embedded) ? embedded[0]?.invite_code : embedded?.invite_code;
    return NextResponse.json({ household_id: existing.household_id, invite_code: code ?? null });
  }

  const { data: household, error: hError } = await admin
    .from("households")
    .insert({ name: body.pair ? "our home" : "my home" })
    .select()
    .single();
  if (hError || !household) {
    return NextResponse.json({ error: hError?.message ?? "failed to create household" }, { status: 500 });
  }

  const { error: mError } = await admin
    .from("household_members")
    .insert({ household_id: household.id, user_id: user.id });
  if (mError) {
    await admin.from("households").delete().eq("id", household.id);
    return NextResponse.json({ error: mError.message }, { status: 500 });
  }

  await admin.from("calendar_settings").insert({
    household_id: household.id,
    selected_colors: [],
    start_date: new Date().toISOString().split("T")[0],
  });

  // 割り勘の固定費の既定の項目（あとから足し引きできる）。表がまだ無い
  // （マイグレーション前）ときは何もしない。
  const now = Date.now();
  await admin.from("split_utilities").insert(
    ["通信", "電気", "ガス", "水道"].map((name, i) => ({
      household_id: household.id,
      name,
      // 並び順を保つため、作成時刻を少しずつずらす
      created_at: new Date(now + i).toISOString(),
    }))
  );

  return NextResponse.json({
    household_id: household.id,
    invite_code: household.invite_code,
  });
}
