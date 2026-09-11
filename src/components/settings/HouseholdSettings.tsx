"use client";

import { useState } from "react";
import { useAuthStore } from "@/store/authStore";

// ソロ ⇄ ペアの切り替え。
// モードはフラグではなく「世帯のメンバーが何人か」から決まるので、
// 招待コードを渡して相手が入ればペア、外せばソロに戻る。

export function HouseholdSettings() {
  const { user, inviteCode, members, memberCount, isOwner, refreshMembers } = useAuthStore();
  const [confirming, setConfirming] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");

  const solo = memberCount !== null && memberCount <= 1;
  const partner = members.find((m) => m.userId !== user?.id);

  const removePartner = async () => {
    if (!partner) return;
    setWorking(true);
    setError("");
    try {
      const res = await fetch("/api/household/remove-member", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: partner.userId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "failed to remove partner");
      }
      await refreshMembers();
      setConfirming(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
    }
    setWorking(false);
  };

  return (
    <div className="space-y-3">
      <p className="text-[10px] tracking-widest text-muted-foreground uppercase">household</p>

      {solo ? (
        <>
          <p className="text-[13px]">1人で使用中</p>
          {inviteCode && (
            <>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                この招待コードを相手に渡すと、2人で使えるようになります。
                予定・やること・買い物などがすべて共有されます。
              </p>
              <p className="text-xl tracking-widest font-medium">{inviteCode}</p>
            </>
          )}
        </>
      ) : (
        <>
          <p className="text-[13px]">2人で使用中</p>
          <p className="text-[11px] text-muted-foreground">
            {partner?.displayName || "パートナー"} と共有しています
          </p>

          {isOwner && partner && (
            confirming ? (
              <div className="space-y-2 pt-1">
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  相手を世帯から外すと、相手はこの世帯のデータを見られなくなります。
                  データ自体は残り、1人で使う状態に戻ります。
                </p>
                <div className="flex gap-4">
                  <button
                    onClick={removePartner}
                    disabled={working}
                    className="text-[11px] text-red-500 underline disabled:opacity-50"
                  >
                    {working ? "処理中..." : "外す"}
                  </button>
                  <button
                    onClick={() => setConfirming(false)}
                    className="text-[11px] text-muted-foreground underline"
                  >
                    やめる
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => { setConfirming(true); setError(""); }}
                className="text-[11px] text-muted-foreground underline"
              >
                1人で使う状態に戻す
              </button>
            )
          )}
        </>
      )}

      {error && <p className="text-[11px] text-red-500">{error}</p>}
    </div>
  );
}
