"use client";

import { Capacitor } from "@capacitor/core";
import type { Provider } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { NATIVE_AUTH_REDIRECT } from "@/lib/constants";

// iOS アプリでのログイン。
//
// Google は 2023年2月から、WKWebView のような埋め込みブラウザからの OAuth を
// disallowed_useragent で拒否している。Capacitor の WebView はまさにそれなので、
// ブラウザでは通るログインが、アプリに包んだ瞬間 403 になる。
//
// 対策は、認証だけ端末の Safari（SFSafariViewController）に出して、
// 終わったらカスタムスキームでアプリに戻すこと。Google の規約上もこれが正しい形。
//
//   WebView            Safari                   WebView
//   signInWithOAuth →  Google → Supabase →      appUrlOpen
//   （URLだけ取る）                              → exchangeCodeForSession
//
// 【PKCE の注意】code_verifier は WebView 側の cookie にある。
// Safari 側でコード交換をすると verifier が無くて失敗するので、
// 交換は必ずアプリに戻ってから WebView 側で行う。だから redirectTo には
// サーバーの /auth/callback ではなくカスタムスキームを渡している。

export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform();
}

type OAuthOptions = {
  scopes?: string;
  queryParams?: Record<string, string>;
};

/**
 * ログインを開始する。ブラウザでは今までどおり画面遷移、
 * iOS アプリでは Safari を開いて戻りを待つ。
 */
export async function startOAuth(
  provider: Provider,
  options: OAuthOptions = {}
): Promise<void> {
  const supabase = createClient();

  if (!isNativeApp()) {
    await supabase.auth.signInWithOAuth({
      provider,
      options: { ...options, redirectTo: `${window.location.origin}/auth/callback` },
    });
    return;
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      ...options,
      redirectTo: NATIVE_AUTH_REDIRECT,
      // 画面を飛ばさず URL だけ受け取る。飛ばすと WebView 内で開いてしまう
      skipBrowserRedirect: true,
    },
  });
  if (error || !data?.url) throw error ?? new Error("no oauth url");

  const { Browser } = await import("@capacitor/browser");
  await Browser.open({ url: data.url, presentationStyle: "popover" });
}

let deepLinkBound = false;

/**
 * 戻ってきたディープリンクを受けてセッションを確立する。
 * アプリ起動時に一度だけ呼ぶ。ブラウザでは何もしない。
 */
export async function initDeepLinkAuth(onSignedIn: () => void): Promise<void> {
  if (!isNativeApp() || deepLinkBound) return;
  deepLinkBound = true;

  const [{ App }, { Browser }] = await Promise.all([
    import("@capacitor/app"),
    import("@capacitor/browser"),
  ]);

  App.addListener("appUrlOpen", async ({ url }) => {
    if (!url.startsWith(NATIVE_AUTH_REDIRECT)) return;

    // Safari を閉じる。閉じないと認証済みの画面が残って戻れたのか分からない
    await Browser.close().catch(() => {});

    // カスタムスキームは URL として素直に解釈されないので、? 以降を自前で取る
    const query = url.includes("?") ? url.slice(url.indexOf("?") + 1) : "";
    const params = new URLSearchParams(query);
    const code = params.get("code");
    if (!code) return;

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) throw error;
      onSignedIn();
    } catch {
      // 交換に失敗したらログイン画面のまま。利用者はもう一度押せる
    }
  });
}
