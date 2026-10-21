"use client";

import { getJSON, setJSON } from "@/lib/storage";
import { LS_PENDING_JOIN } from "@/lib/constants";

// 招待された人が、初回登録の画面で招待コードを入れたが、まだ加入していなかった場合。
//
// すべての機能が有料で、参加には加入が要る。加入（無料体験）は世帯を作ってからでないと
// 始められないので、いったん1人用の世帯を作って加入画面を出し、加入できたら
// 控えておいたコードで自動的に参加する（src/app/page.tsx）。

export function getPendingJoin(): string | null {
  return getJSON<string | null>(LS_PENDING_JOIN, null);
}

export function setPendingJoin(code: string): void {
  setJSON(LS_PENDING_JOIN, code);
}

export function clearPendingJoin(): void {
  try { localStorage.removeItem(LS_PENDING_JOIN); } catch {}
}

const RETRY_DELAY_MS = 2500;
const MAX_TRIES = 6;

/**
 * 控えたコードで参加する。成功したら null、だめなら利用者に見せる文言を返す。
 *
 * 購入の直後は、RevenueCat の webhook がまだ届いておらず、サーバーからは
 * 未加入に見えることがある（402）。数秒おきに何度か試す。
 */
export async function completePendingJoin(code: string): Promise<string | null> {
  for (let i = 0; i < MAX_TRIES; i++) {
    const res = await fetch("/api/household/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invite_code: code }),
    }).catch(() => null);
    if (res?.ok) return null;

    const body = res ? await res.json().catch(() => ({})) : {};
    if (res?.status === 402 || !res) {
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      continue;
    }
    return body.error === "invite code not found" ? `招待コード ${code} の世帯が見つかりませんでした`
      : body.error === "household is full" ? "その世帯はすでに2人で使われています"
      : body.error === "partner subscription lapsed" ? "お相手の加入が切れているため参加できませんでした"
      : "参加できませんでした。設定 → household から、もう一度お試しください";
  }
  return "加入の確認に時間がかかっています。少し待ってから、設定 → household →「相手の世帯に参加する」で入ってください";
}
