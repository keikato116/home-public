"use client";

import { createClient } from "@/lib/supabase/client";

export function AuthGate() {
  const supabase = createClient();

  const signIn = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${location.origin}/auth/callback`,
        scopes: "https://www.googleapis.com/auth/calendar.readonly",
        queryParams: { access_type: "online", prompt: "consent" },
      },
    });
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-7">
      <div className="w-full max-w-xs space-y-8">
        <div className="space-y-1">
          <p className="text-[10px] tracking-widest text-muted-foreground uppercase">welcome</p>
          <h1 className="text-2xl tracking-wide">home</h1>
          <p className="text-[11px] text-muted-foreground">shared household app</p>
        </div>

        <button
          onClick={signIn}
          className="w-full border border-border rounded px-4 py-3 text-[12px] tracking-wider hover:bg-muted transition-colors text-left"
        >
          sign in with google
        </button>
      </div>
    </div>
  );
}
