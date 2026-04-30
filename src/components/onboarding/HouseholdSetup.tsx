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

  const createHousehold = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/household/create", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setCreatedCode(data.invite_code);
      setHouseholdId(data.household_id, data.invite_code);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "something went wrong");
    }
    setLoading(false);
  };

  const joinHousehold = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/household/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invite_code: inviteInput }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setHouseholdId(data.household_id);
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
              onClick={() => { setMode("create"); createHousehold(); }}
              className="w-full border border-border rounded px-4 py-3 text-[12px] tracking-wider hover:bg-muted transition-colors text-left"
            >
              create a new household
            </button>
            <button
              onClick={() => setMode("join")}
              className="w-full border border-border rounded px-4 py-3 text-[12px] tracking-wider hover:bg-muted transition-colors text-left"
            >
              join with invite code
            </button>
          </div>
        )}

        {mode === "create" && (
          <div className="space-y-4">
            {loading && <p className="text-[11px] text-muted-foreground">creating...</p>}
            {createdCode && (
              <div className="space-y-2">
                <p className="text-[10px] tracking-widest text-muted-foreground uppercase">invite code</p>
                <p className="text-2xl tracking-widest font-medium">{createdCode}</p>
                <p className="text-[11px] text-muted-foreground">share this code with your partner</p>
              </div>
            )}
            {error && <p className="text-[11px] text-red-500">{error}</p>}
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
