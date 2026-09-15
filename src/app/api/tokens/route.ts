import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { encryptToken, decryptToken } from "@/lib/server/tokenCrypto";

// Google のトークンの読み書き口。
//
// 以前はブラウザが user_tokens を直接 upsert していた。暗号化の鍵はサーバーに
// しか置けない（ブラウザに配ったら意味が無い）ので、書き込みをここに集めた。
//
// 扱うのは **呼び出した本人の行だけ**。他人の行には触れない。相手のカレンダーは
// /api/partner-calendar が別途 service_role で取りに行く。

async function callerAndAdmin() {
  const cookieStore = await cookies();
  const anon = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
  const { data: { user } } = await anon.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return { error: NextResponse.json({ error: "service role not configured" }, { status: 503 }) };
  }
  const admin = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey,
    { cookies: { getAll: () => [], setAll: () => {} } }
  );
  return { user, admin };
}

/** 自分のリフレッシュトークンを返す。localStorage が消えたときの復旧用。 */
export async function GET() {
  const ctx = await callerAndAdmin();
  if (ctx.error) return ctx.error;
  const { user, admin } = ctx;

  const { data } = await admin
    .from("user_tokens")
    .select("google_refresh_token")
    .eq("user_id", user.id)
    .maybeSingle();

  // 本人に本人のトークンを返すだけなので、復号して渡してよい。
  // 端末には元々同じものが localStorage にある。
  return NextResponse.json({
    refreshToken: decryptToken(data?.google_refresh_token as string | undefined) || null,
  });
}

/**
 * 自分のトークンを保存する。渡された項目だけを更新する
 * （アクセストークンだけの更新でリフレッシュトークンを消さないため）。
 */
export async function POST(request: Request) {
  const ctx = await callerAndAdmin();
  if (ctx.error) return ctx.error;
  const { user, admin } = ctx;

  let body: { accessToken?: string; refreshToken?: string; householdId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  // householdId は呼び出し元の自己申告なので、実際の所属を引き直す。
  // 申告を信じると、他人の世帯を指す行を作れてしまう。
  const { data: membership } = await admin
    .from("household_members")
    .select("household_id")
    .eq("user_id", user.id)
    .maybeSingle();

  const row: Record<string, unknown> = {
    user_id: user.id,
    household_id: membership?.household_id ?? null,
    updated_at: new Date().toISOString(),
  };

  try {
    if (body.accessToken !== undefined) {
      row.google_access_token = encryptToken(body.accessToken);
    }
    if (body.refreshToken !== undefined) {
      row.google_refresh_token = encryptToken(body.refreshToken);
    }
  } catch (e) {
    // 鍵の設定漏れ。平文で保存せず、はっきり失敗させる。
    console.error("[tokens] encryption failed", e);
    return NextResponse.json({ error: "encryption not configured" }, { status: 503 });
  }

  const { error } = await admin.from("user_tokens").upsert(row);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
