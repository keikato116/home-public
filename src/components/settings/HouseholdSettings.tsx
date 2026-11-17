"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/authStore";
import { createClient } from "@/lib/supabase/client";
import { LS_CACHED_INVITE } from "@/lib/constants";
import { JoinRequestsPanel } from "@/components/household/JoinRequestsPanel";
import { joinErrorMessage, reloadAfterMembershipChange } from "@/lib/joinRequests";

// ソロ ⇄ ペアの切り替え。
// モードはフラグではなく「世帯のメンバーが何人か」から決まるので、
// 招待コードで参加の申請を受けて承認すればペア、解散すればソロに戻る。
// 招待コードはだれかが入った・抜けたたびに作り直される（src/lib/server/householdJoin.ts）。

export function HouseholdSettings() {
  const { user, householdId, inviteCode, members, memberCount, isOwner } = useAuthStore();
  const [confirming, setConfirming] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [joining, setJoining] = useState(false);
  const [joinCode, setJoinCode] = useState("");

  const setInviteCode = (code: string) => {
    useAuthStore.setState({ inviteCode: code });
    try { localStorage.setItem(LS_CACHED_INVITE, code); } catch {}
  };

  // 申請を出したあと、申請の欄を読み直させるため
  const [panelKey, setPanelKey] = useState(0);
  const [notice, setNotice] = useState("");

  const solo = memberCount !== null && memberCount <= 1;

  // 招待コードは作り直されるので、端末に控えたものではなく今のものを読む
  useEffect(() => {
    if (!householdId) return;
    let cancelled = false;
    createClient()
      .from("households")
      .select("invite_code")
      .eq("id", householdId)
      .maybeSingle()
      .then(({ data }) => {
        const code = data?.invite_code as string | undefined;
        if (!cancelled && code && code !== useAuthStore.getState().inviteCode) setInviteCode(code);
      });
    return () => { cancelled = true; };
  }, [householdId]);

  // 課金切れで前の世帯から自動退出した人には、戻る申請の入口を出す。
  // 値は残っている人の表示名（名前が無ければ空文字）。前の部屋が無ければ null
  // （supabase/migrations/2026-11-17_join_requests.sql）。
  const [pausedRoomWith, setPausedRoomWith] = useState<string | null>(null);
  useEffect(() => {
    if (!solo) return;
    let cancelled = false;
    createClient()
      .rpc("my_paused_room")
      .then(({ data }) => {
        if (!cancelled && typeof data === "string") setPausedRoomWith(data);
      });
    return () => { cancelled = true; };
  }, [solo]);

  const rotateCode = async () => {
    setWorking(true);
    setError("");
    try {
      const res = await fetch("/api/household/invite-code", { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.invite_code) throw new Error(joinErrorMessage(body.error));
      setInviteCode(body.invite_code);
      setNotice("招待コードを作り直しました。前のコードはもう使えません。");
    } catch (e) {
      setError(e instanceof Error ? e.message : joinErrorMessage(null));
    }
    setWorking(false);
  };

  // 申請を出す。コードで出すか、課金切れで抜けた前の部屋に戻るか。
  const request = async (payload: { invite_code: string } | { return_to_paused: true }) => {
    setWorking(true);
    setError("");
    setNotice("");
    try {
      const res = await fetch("/api/household/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(joinErrorMessage(body.error));
      setJoining(false);
      setJoinCode("");
      setPanelKey((k) => k + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : joinErrorMessage(null));
    }
    setWorking(false);
  };
  const partner = members.find((m) => m.userId !== user?.id);
  const partnerName = partner?.displayName || "相手";

  const dissolve = async () => {
    setWorking(true);
    setError("");
    try {
      const res = await fetch("/api/household/dissolve", { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "failed to dissolve");

      // 抜けた側は新しい1人用の世帯に、残った側は作り直された招待コードに変わるので、
      // どちらも端末の控えを捨てて読み込み直す。
      reloadAfterMembershipChange();
      return;
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
    }
    setWorking(false);
  };

  // すでに1人で使っている人が、相手の世帯への参加を申請する。
  // 招待コードを入れる画面は「世帯を持っていない人」にしか出ないので、
  // これが無いと2人ともそれぞれ世帯を作った時点で合流できなくなる。
  const join = () => {
    const code = joinCode.trim().toUpperCase();
    if (code) request({ invite_code: code });
  };

  return (
    <div className="space-y-3">
      <p className="text-[10px] tracking-widest text-muted-foreground uppercase">household</p>

      <JoinRequestsPanel key={panelKey} />

      {solo ? (
        <>
          <p className="text-[13px]">1人で使用中</p>
          {pausedRoomWith !== null && (
            <div className="border border-border rounded-xl px-4 py-3 space-y-2">
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                課金状態が切れたため、{pausedRoomWith ? `${pausedRoomWith} さんとの` : "前の"}世帯から退出しました。
                2人で使っていたデータは残っています。再び加入して戻る申請を出し、お相手が承認すると、元どおり再開します。
              </p>
              <button
                onClick={() => request({ return_to_paused: true })}
                disabled={working}
                className="text-[11px] text-foreground underline underline-offset-2 disabled:opacity-50"
              >
                前の世帯に戻る申請を出す
              </button>
            </div>
          )}
          {inviteCode && (
            <>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                この招待コードを相手に渡すと、相手から参加の申請が届きます。承認すると2人で使えるようになり、
                予定・やること・買い物などがすべて共有されます。コードは、だれかが参加したり抜けたりするたびに変わります。
              </p>
              <p className="text-xl tracking-widest font-medium">{inviteCode}</p>
              <button
                onClick={rotateCode}
                disabled={working}
                className="text-[11px] text-muted-foreground underline underline-offset-2 disabled:opacity-50"
              >
                招待コードを作り直す
              </button>
              {notice && <p className="text-[11px] text-muted-foreground">{notice}</p>}
            </>
          )}

          <div className="border-t border-border/40 pt-3 space-y-2">
            {joining ? (
              <>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  相手の招待コードを入れると、参加の申請が届きます。相手が承認すると、その世帯に移ります。
                  いまのレシピ・家事・やること・献立は持っていきます。
                  <strong className="text-foreground">
                    1人で使っていた割り勘の記録は引き継がれません。
                  </strong>
                </p>
                <div className="flex items-center gap-2">
                  <input
                    autoFocus
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    onKeyDown={(e) => { if (e.key === "Enter") join(); }}
                    placeholder="招待コード"
                    maxLength={8}
                    className="flex-1 bg-background border border-border rounded px-3 py-2 text-[14px] tracking-widest"
                  />
                  <button
                    onClick={join}
                    disabled={working || !joinCode.trim()}
                    className="text-[11px] text-foreground underline disabled:opacity-40 flex-shrink-0"
                  >
                    {working ? "申請中..." : "申請"}
                  </button>
                </div>
                <button
                  onClick={() => { setJoining(false); setJoinCode(""); setError(""); }}
                  disabled={working}
                  className="text-[11px] text-muted-foreground disabled:opacity-40"
                >
                  やめる
                </button>
              </>
            ) : (
              <button
                onClick={() => setJoining(true)}
                className="text-[11px] text-muted-foreground underline underline-offset-2"
              >
                相手の世帯に参加する
              </button>
            )}
            {error && <p className="text-[11px] text-red-500 leading-relaxed">{error}</p>}
          </div>
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
