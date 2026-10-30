import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  // 戻り先は同じサイトの中だけ。"//evil.example" や "https://..." を渡されて
  // よそへ飛ばされないようにする
  const nextParam = url.searchParams.get("next") ?? "/";
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/";
  const dest = new URL(next, url.origin);

  // 失敗したときは理由をログイン画面に出す（黙ってログイン画面に戻すと、
  // 何度押しても戻される理由がわからない）
  const providerError = url.searchParams.get("error_description") ?? url.searchParams.get("error");
  if (providerError) {
    dest.searchParams.set("auth_error", providerError);
  } else if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.error("[auth/callback] exchangeCodeForSession failed", error.message);
      dest.searchParams.set("auth_error", error.message);
    }
  }

  return NextResponse.redirect(dest);
}
