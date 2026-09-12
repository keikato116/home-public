"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { startGoogleOAuth } from "@/lib/googleToken";

// ログインの入口。
//
// Google だけだと App Store の Guideline 4.8 を満たさない。あそこは
// 「名前とメールに限る・メールを隠せる・広告目的で追跡しない」の3条件を満たす
// ログイン手段を併せて用意することを求めていて、Google はどれも満たさない。
// Sign in with Apple はその3条件を満たすので、並べて置いてある。
//
// Apple で入った人は Google のトークンを持たないので、カレンダーは
// 手入力の予定だけになる。calendar タブに「connect google calendar」が出て、
// そこから後付けで繋げられる（connectGoogleCalendar が identity を紐付ける）。

export function AuthGate() {
  const supabase = createClient();
  const [busy, setBusy] = useState<"google" | "apple" | null>(null);

  const signInWithGoogle = async () => {
    setBusy("google");
    try {
      await startGoogleOAuth(supabase);
    } finally {
      setBusy(null);
    }
  };

  const signInWithApple = async () => {
    setBusy("apple");
    try {
      await supabase.auth.signInWithOAuth({
        provider: "apple",
        options: { redirectTo: `${location.origin}/auth/callback` },
      });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-7">
      <div className="w-full max-w-xs space-y-8">
        <div className="space-y-1">
          <p className="text-[10px] tracking-widest text-muted-foreground uppercase">welcome</p>
          <h1 className="text-2xl tracking-wide">home</h1>
          <p className="text-[11px] text-muted-foreground">shared household app</p>
        </div>

        <div className="space-y-2.5">
          {/* Apple の表記と意匠は変えないこと（HIG の指定。審査で見られる） */}
          <button
            onClick={signInWithApple}
            disabled={busy !== null}
            className="w-full bg-black text-white rounded px-4 py-3 text-[13px] flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <svg viewBox="0 0 384 512" className="w-3.5 h-3.5 fill-current" aria-hidden="true">
              <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" />
            </svg>
            Sign in with Apple
          </button>

          <button
            onClick={signInWithGoogle}
            disabled={busy !== null}
            className="w-full border border-border rounded px-4 py-3 text-[12px] tracking-wider hover:bg-muted transition-colors text-left disabled:opacity-50"
          >
            sign in with google
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
