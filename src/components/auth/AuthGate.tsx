"use client";

import { useState } from "react";
import { startOAuth } from "@/lib/nativeAuth";
import { GOOGLE_CALENDAR_SCOPE } from "@/lib/constants";

// ログインの入口。
//
// Google だけだと App Store の Guideline 4.8 を満たさない。あそこは
// 「名前とメールに限る・メールを隠せる・広告目的で追跡しない」の3条件を満たす
// ログイン手段を併せて用意することを求めていて、Google はどれも満たさない。
// Sign in with Apple はその3条件を満たすので、並べて置いてある。
//
// iOS アプリでは、認証だけ Safari に出して戻ってくる（Google が WebView からの
// OAuth を拒否するため）。その分岐は startOAuth の中にある。
//
// Apple で入った人は Google のトークンを持たないので、カレンダーは
// 手入力の予定だけになる。calendar タブに「connect google calendar」が出て、
// そこから後付けで繋げられる（connectGoogleCalendar が identity を紐付ける）。

export function AuthGate() {
  const [busy, setBusy] = useState<"google" | "apple" | null>(null);

  const signInWithGoogle = async () => {
    setBusy("google");
    try {
      await startOAuth("google", {
        scopes: GOOGLE_CALENDAR_SCOPE,
        queryParams: { access_type: "offline", prompt: "consent" },
      });
    } finally {
      setBusy(null);
    }
  };

  const signInWithApple = async () => {
    setBusy("apple");
    try {
      await startOAuth("apple");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-7">
      <div className="w-full max-w-xs space-y-8">
        <div className="space-y-1">
          <p className="text-[10px] tracking-widest text-muted-foreground uppercase">welcome</p>
          <h1 className="text-2xl tracking-wide">Imbrex</h1>
          <p className="text-[11px] text-muted-foreground">shared household app</p>
        </div>

        <div className="space-y-2.5">
          {/* Both buttons share one geometry (height, radius, type size, icon box,
              gap) so the pair reads as one control. What must NOT be unified is
              the mark and the colours: Apple's HIG and Google's branding
              guidelines each require their own logo, drawn unmodified, on their
              own background. Apple's wording is fixed too, and reviewers check
              it. The light/dark swap lives in globals.css. */}
          <button
            onClick={signInWithApple}
            disabled={busy !== null}
            className="btn-provider btn-apple w-full rounded min-h-[44px] px-4 py-3 text-[13px] flex items-center justify-center gap-2.5 disabled:opacity-50"
          >
            <svg viewBox="0 0 384 512" className="w-4 h-4 fill-current shrink-0" aria-hidden="true">
              <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" />
            </svg>
            Sign in with Apple
          </button>

          <button
            onClick={signInWithGoogle}
            disabled={busy !== null}
            className="btn-provider btn-google w-full rounded min-h-[44px] px-4 py-3 text-[13px] flex items-center justify-center gap-2.5 disabled:opacity-50"
          >
            {/* Google's four-colour G. It may not be recoloured, so it does not
                use fill-current the way the Apple mark does. */}
            <svg viewBox="0 0 48 48" className="w-4 h-4 shrink-0" aria-hidden="true">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
            </svg>
            Sign in with Google
          </button>
        </div>

        <p className="text-[10px] text-muted-foreground leading-relaxed">
          Google で入るとカレンダーの予定も表示されます。
          Apple で入った場合も、あとから設定できます。
        </p>
      </div>
    </div>
  );
}
