"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuthStore } from "@/store/authStore";
import {
  LS_CACHED_HOUSEHOLD, LS_CACHED_INVITE, LS_CACHED_IS_OWNER, LS_CACHED_MEMBER_COUNT,
} from "@/lib/constants";

// 世帯への参加の申請（承認制）。サーバー側は src/lib/server/householdJoin.ts。

export interface IncomingRequest {
  requester_id: string;
  name: string;
  email: string | null;
  /** 課金切れで抜けた前のメンバーが戻ろうとしている */
  returning: boolean;
  created_at: string;
}

export interface OutgoingRequest {
  created_at: string;
  returning: boolean;
}

/** /api/household/join・/api/household/requests のエラーを、画面に出す文に直す。 */
export function joinErrorMessage(error: unknown): string {
  switch (error) {
    case "invite code not found":
      return "この招待コードの世帯が見つからないか、すでに2人で使われています";
    case "too many attempts":
      return "試した回数が多すぎます。1時間ほど待ってからお試しください";
    case "leave your current household first":
      return "いまの世帯を解散してから参加してください";
    case "subscription required":
      return "参加するには、先に加入してください（設定 → premium）";
    case "partner subscription lapsed":
      return "お相手の加入が切れているため参加できません";
    case "no previous household":
      return "前の世帯が見つかりません。お相手から招待コードを教えてもらってください";
    case "request not found":
      return "この申請はもう取り消されたか、期限が切れています";
    default:
      return "うまくいきませんでした。時間をおいてお試しください";
  }
}

/** 所属が変わったので、端末に控えた世帯の情報を捨てて読み込み直す。 */
export function reloadAfterMembershipChange(): void {
  for (const key of [LS_CACHED_HOUSEHOLD, LS_CACHED_INVITE, LS_CACHED_IS_OWNER, LS_CACHED_MEMBER_COUNT]) {
    try { localStorage.removeItem(key); } catch {}
  }
  window.location.href = "/";
}

const POLL_MS = 20_000;

/**
 * 申請の状態を読み、画面が開いている間は定期的に読み直す。
 * 自分の申請が承認されて別の世帯に移っていたら、読み込み直す。
 */
export function useJoinRequests() {
  const householdId = useAuthStore((s) => s.householdId);
  const [incoming, setIncoming] = useState<IncomingRequest[]>([]);
  const [outgoing, setOutgoing] = useState<OutgoingRequest | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const hadOutgoing = useRef(false);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/household/requests").catch(() => null);
    if (!res?.ok) return;
    const body = (await res.json().catch(() => ({}))) as {
      household_id?: string | null; incoming?: IncomingRequest[]; outgoing?: OutgoingRequest | null;
    };
    // 申請していた世帯に入れてもらえた（サーバーの所属が、端末の控えと変わった）
    if (hadOutgoing.current && !body.outgoing && body.household_id && body.household_id !== householdId) {
      reloadAfterMembershipChange();
      return;
    }
    hadOutgoing.current = !!body.outgoing;
    setIncoming(body.incoming ?? []);
    setOutgoing(body.outgoing ?? null);
  }, [householdId]);

  useEffect(() => {
    if (!householdId) return;
    refresh();
    const tick = () => { if (document.visibilityState === "visible") refresh(); };
    const id = setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", tick);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", tick); };
  }, [householdId, refresh]);

  const send = useCallback(async (payload: Record<string, unknown>) => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/household/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(joinErrorMessage(body.error));
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : joinErrorMessage(null));
      await refresh();
      return false;
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  const approve = useCallback(async (requesterId: string) => {
    // 相手が入ると予定・家事・割り勘の見え方が全部変わるので、読み込み直す
    if (await send({ action: "approve", requester_id: requesterId })) reloadAfterMembershipChange();
  }, [send]);

  const decline = useCallback(async (requesterId: string) => {
    if (await send({ action: "decline", requester_id: requesterId })) await refresh();
  }, [send, refresh]);

  const cancel = useCallback(async () => {
    if (await send({ action: "cancel" })) {
      hadOutgoing.current = false;
      await refresh();
    }
  }, [send, refresh]);

  return { incoming, outgoing, busy, error, refresh, approve, decline, cancel };
}
