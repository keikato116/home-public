"use client";

import { useState } from "react";
import { useAuthStore } from "@/store/authStore";
import { createClient } from "@/lib/supabase/client";

export function HouseholdSetup() {
  const { user, setHouseholdId } = useAuthStore();
  const [inviteInput, setInviteInput] = useState("");
  const [mode, setMode] = useState<"select" | "create" | "join">("select");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [createdCode, setCreatedCode] = useState("");
  // ペアで作った場合は、招待コードを見せてから本人が「はじめる」を押すまで
  // setHouseholdId を待つ。先に呼ぶとこの画面ごと消えてコードが見えない。
  const [createdId, setCreatedId] = useState("");

  // 1人でも成立するアプリなので、世帯 = 1人で始められる。
  // あとから招待コードを渡せばペアになるし、外せばソロに戻る。
  const createHousehold = async (pair: boolean) => {
    if (!user) return;
    setLoading(true);
    setError("");
    try {
      const supabase = createClient();

      const { data: household, error: hErr } = await supabase
        .from("households")
        .insert({ name: pair ? "our home" : "my home" })
        .select()
        .single();
      if (hErr || !household) throw new Error(hErr?.message ?? "failed to create household");

      const { error: mErr } = await supabase
        .from("household_members")
        .insert({ household_id: household.id, user_id: user.id });
      if (mErr) throw new Error(mErr.message);

      await supabase.from("calendar_settings").insert({
        household_id: household.id,
        selected_colors: [],
        start_date: new Date().toISOString().split("T")[0],
      });

      if (pair) {
        setCreatedId(household.id);
        setCreatedCode(household.invite_code);
      } else {
        setHouseholdId(household.id, household.invite_code);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "something went wrong");
    }
    setLoading(false);
  };

  const joinHousehold = async () => {
    if (!user) return;
    setLoading(true);
    setError("");
    try {
      const supabase = createClient();

      const { data: household, error: hErr } = await supabase
        .from("households")
        .select("id, invite_code")
        .eq("invite_code", inviteInput.toUpperCase())
        .single();
      if (hErr || !household) throw new Error("invite code not found");

      const { error: mErr } = await supabase
        .from("household_members")
        .insert({ household_id: household.id, user_id: user.id });
      if (mErr && !mErr.message.includes("duplicate")) throw new Error(mErr.message);

      setHouseholdId(household.id);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "something went wrong");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-7">
      <div className="w-full max-w-xs space-y-8">
        <div className="space-y-1">
          <p className="text-[10px] tracking-widest text-muted-foreground uppercase">setup</p>
          <h1 className="text-xl tracking-wide">get started</h1>
          <p className="text-[11px] text-muted-foreground">{user?.email}</p>
        </div>

        {mode === "select" && (
          <div className="space-y-3">
            <button
              onClick={() => { setMode("create"); createHousehold(false); }}
              className="w-full border border-border rounded px-4 py-3 hover:bg-muted transition-colors text-left"
            >
              <span className="block text-[12px] tracking-wider">1人で使う</span>
              <span className="block text-[10px] text-muted-foreground mt-0.5">あとから2人に切り替えられます</span>
            </button>
            <button
              onClick={() => { setMode("create"); createHousehold(true); }}
              className="w-full border border-border rounded px-4 py-3 hover:bg-muted transition-colors text-left"
            >
              <span className="block text-[12px] tracking-wider">2人で使う</span>
              <span className="block text-[10px] text-muted-foreground mt-0.5">招待コードを相手に渡します</span>
            </button>
            <button
              onClick={() => setMode("join")}
              className="w-full border border-border rounded px-4 py-3 text-[12px] tracking-wider hover:bg-muted transition-colors text-left"
            >
              招待コードで参加する
            </button>
          </div>
        )}

        {mode === "create" && (
          <div className="space-y-4">
            {loading && <p className="text-[11px] text-muted-foreground">creating...</p>}
            {createdCode && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <p className="text-[10px] tracking-widest text-muted-foreground uppercase">invite code</p>
                  <p className="text-2xl tracking-widest font-medium">{createdCode}</p>
                  <p className="text-[11px] text-muted-foreground">
                    このコードを相手に渡してください。あとで設定からも確認できます。
                  </p>
                </div>
                <button
                  onClick={() => setHouseholdId(createdId, createdCode)}
                  className="w-full bg-foreground text-background rounded px-4 py-3 text-[12px] tracking-wider"
                >
                  はじめる
                </button>
              </div>
            )}
            {error && (
              <>
                <p className="text-[11px] text-red-500">{error}</p>
                <button
                  onClick={() => { setError(""); setMode("select"); }}
                  className="w-full text-[11px] text-muted-foreground hover:text-foreground"
                >
                  back
                </button>
              </>
            )}
          </div>
        )}

        {mode === "join" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-[10px] tracking-widest text-muted-foreground uppercase">invite code</p>
              <input
                type="text"
                value={inviteInput}
                onChange={(e) => setInviteInput(e.target.value.toUpperCase())}
                placeholder="XXXXXXXX"
                className="w-full bg-transparent border-b border-border pb-2 text-sm tracking-widest focus:outline-none focus:border-foreground/40 uppercase"
                maxLength={8}
              />
            </div>
            {error && <p className="text-[11px] text-red-500">{error}</p>}
            <button
              onClick={joinHousehold}
              disabled={loading || inviteInput.length < 6}
              className="w-full bg-foreground text-background rounded px-4 py-3 text-[12px] tracking-wider disabled:opacity-40"
            >
              {loading ? "joining..." : "join"}
            </button>
            <button
              onClick={() => setMode("select")}
              className="w-full text-[11px] text-muted-foreground hover:text-foreground"
            >
              back
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
