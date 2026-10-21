"use client";

import { useState } from "react";
import { useAuthStore } from "@/store/authStore";

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
  //
  // 作成も参加もサーバーで行う。クライアントから households / household_members に
  // 直接書けると、他人の世帯に勝手に入れてしまうため（2026-10-21_close_household_join.sql）。
  const createHousehold = async (pair: boolean) => {
    if (!user) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/household/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pair }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.household_id) throw new Error(body.error ?? "failed to create household");

      if (pair) {
        setCreatedId(body.household_id);
        setCreatedCode(body.invite_code ?? "");
      } else {
        setHouseholdId(body.household_id, body.invite_code ?? undefined);
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
      const res = await fetch("/api/household/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invite_code: inviteInput.trim().toUpperCase() }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          body.error === "invite code not found" ? "この招待コードの世帯が見つかりません"
          : body.error === "household is full" ? "その世帯はすでに2人で使われています"
          // すべての機能が有料で、2人とも加入が必要。加入（無料体験）は世帯を作ってから
          // できるので、いったん1人で始めてもらう。
          : body.error === "subscription required"
            ? "参加するには、先に加入（1か月無料）が必要です。「1人で使う」で始めて加入したあと、設定 → household →「相手の世帯に参加する」から入ってください"
          : body.error === "partner subscription lapsed" ? "お相手の加入が切れているため参加できません"
          : body.error ?? "参加できませんでした"
        );
      }
      setHouseholdId(body.household_id, body.invite_code ?? undefined);
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
