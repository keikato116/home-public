"use client";

import { useState } from "react";
import { useAuthStore } from "@/store/authStore";
import {
  LS_CACHED_HOUSEHOLD, LS_CACHED_INVITE, LS_CACHED_IS_OWNER, LS_CACHED_MEMBER_COUNT,
} from "@/lib/constants";

// ソロ ⇄ ペアの切り替え。
// モードはフラグではなく「世帯のメンバーが何人か」から決まるので、
// 招待コードを渡して相手が入ればペア、解散すればソロに戻る。

export function HouseholdSettings() {
  const { user, inviteCode, members, memberCount, isOwner, refreshMembers } = useAuthStore();
  const [confirming, setConfirming] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");

  const solo = memberCount !== null && memberCount <= 1;
  const partner = members.find((m) => m.userId !== user?.id);
  const partnerName = partner?.displayName || "相手";

  const dissolve = async () => {
    setWorking(true);
    setError("");
    try {
      const res = await fetch("/api/household/dissolve", { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "failed to dissolve");

      if (body.left) {
        // 自分が抜けた側。新しい1人用の世帯はサーバー側で作られているので、
        // 古い世帯のキャッシュを消して読み込み直せばそのまま使い始められる。
        for (const key of [
          LS_CACHED_HOUSEHOLD, LS_CACHED_INVITE, LS_CACHED_IS_OWNER, LS_CACHED_MEMBER_COUNT,
        ]) {
          try { localStorage.removeItem(key); } catch {}
        }
        window.location.href = "/";
        return;
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
            {partnerName} と共有しています
          </p>

          {confirming ? (
            <div className="space-y-2 pt-1">
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                解散すると、おたがいの予定が見えなくなり、1人で使う状態に戻ります。
              </p>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                {isOwner
                  ? `2人で使っていたデータはこのままあなたに残り、${partnerName} は見られなくなります。${partnerName} にしか見えなかった買い物リストは ${partnerName} が持っていきます。`
                  : `2人で使っていたデータは ${partnerName} に残ります。あなたにしか見えない買い物リストは、そのままあなたに残ります。`}
              </p>
              <div className="flex gap-4">
                <button
                  onClick={dissolve}
                  disabled={working}
                  className="text-[11px] text-red-500 underline disabled:opacity-50"
                >
                  {working ? "処理中..." : "解散する"}
                </button>
                <button
                  onClick={() => setConfirming(false)}
                  disabled={working}
                  className="text-[11px] text-muted-foreground underline disabled:opacity-50"
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
              グループを解散する
            </button>
          )}
        </>
      )}

      {error && <p className="text-[11px] text-red-500">{error}</p>}
    </div>
  );
}
