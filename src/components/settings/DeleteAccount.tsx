"use client";

import { useState } from "react";
import { useAuthStore } from "@/store/authStore";
import { useSubscriptionStore } from "@/store/subscriptionStore";
import {
  MANAGE_SUBSCRIPTION_URL,
  LS_CACHED_USER, LS_CACHED_HOUSEHOLD, LS_CACHED_INVITE, LS_CACHED_IS_OWNER,
  LS_CACHED_MEMBER_COUNT, LS_ENTITLED_CACHE,
  LS_GOOGLE_TOKEN, LS_GOOGLE_TOKEN_EXPIRY, LS_GOOGLE_REFRESH,
} from "@/lib/constants";

// アカウント削除（App Store Guideline 5.1.1(v)）。
// 「サポートに連絡してください」ではダメで、アプリ内で完結する必要がある。
//
// 課金について: アプリ側から解約することは Apple の仕組み上できない
// （サブスクの契約相手は開発者ではなく Apple で、解約できるのは本人だけ）。
// 黙って削除させると請求だけが残るので、課金中の人には解約画面を開くボタンを
// 先に踏ませ、済ませたことを確認してから削除させる。

export function DeleteAccount() {
  const { memberCount, signOut } = useAuthStore();
  const entitled = useSubscriptionStore((s) => s.entitled);
  const [confirming, setConfirming] = useState(false);
  const [cancelAcknowledged, setCancelAcknowledged] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");

  const solo = memberCount !== null && memberCount <= 1;
  const subscribed = entitled === true;
  const canDelete = !subscribed || cancelAcknowledged;

  const remove = async () => {
    setWorking(true);
    setError("");
    try {
      const res = await fetch("/api/account", { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "failed to delete account");
      }
      // ここから先は失敗しても「削除できなかった」ことにはしない。
      // ユーザーはもう消えているので、サインアウト API は 403 を返しうるし、
      // それでエラーを出すと「消えたのに失敗と言われる」状態になる。
      try {
        await signOut();
      } catch {
        // 握りつぶす。下でキャッシュを直接消してリロードする。
      }
      // 通常のサインアウトは SIGNED_OUT イベント経由でキャッシュを消すが、
      // ユーザーが消えているとそのイベントが来ないことがあるので自分で消す。
      for (const key of [
        LS_CACHED_USER, LS_CACHED_HOUSEHOLD, LS_CACHED_INVITE, LS_CACHED_IS_OWNER,
        LS_CACHED_MEMBER_COUNT, LS_ENTITLED_CACHE,
        LS_GOOGLE_TOKEN, LS_GOOGLE_TOKEN_EXPIRY, LS_GOOGLE_REFRESH,
      ]) {
        try { localStorage.removeItem(key); } catch {}
      }
      window.location.href = "/";
    } catch (e) {
      setError(e instanceof Error ? e.message : "削除できませんでした");
      setWorking(false);
    }
  };

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="text-[11px] text-muted-foreground hover:text-foreground transition-colors tracking-wider"
      >
        アカウントを削除
      </button>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-[13px]">アカウントを削除しますか？</p>

      <p className="text-[11px] text-muted-foreground leading-relaxed">
        {solo
          ? "予定・やること・買い物リスト・レシピ・献立・精算記録を含む、この世帯のデータがすべて削除されます。"
          : "あなたのアカウントと個人のデータが削除されます。世帯に残るパートナーのデータは削除されません。"}
        <br />
        削除すると元に戻せません。
      </p>

      {subscribed && (
        <div className="space-y-2 border border-border rounded-2xl p-4">
          <p className="text-[12px]">先に有料プランの解約が必要です</p>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            有料プランの契約相手は Apple なので、アプリからは解約できません。
            解約せずに削除すると、請求だけが続いてしまいます。
          </p>
          <a
            href={MANAGE_SUBSCRIPTION_URL}
            target="_blank"
            rel="noreferrer"
            onClick={() => setCancelAcknowledged(true)}
            className="inline-block px-5 py-2 bg-foreground text-background text-[11px] tracking-wider rounded-full"
          >
            解約画面をひらく
          </a>
          <label className="flex items-start gap-2 pt-1 cursor-pointer">
            <input
              type="checkbox"
              checked={cancelAcknowledged}
              onChange={(e) => setCancelAcknowledged(e.target.checked)}
              className="mt-0.5"
            />
            <span className="text-[11px] text-muted-foreground leading-relaxed">
              解約の手続きを済ませました
            </span>
          </label>
        </div>
      )}

      {error && <p className="text-[11px] text-red-500">{error}</p>}

      <div className="flex gap-4">
        <button
          onClick={remove}
          disabled={working || !canDelete}
          className="text-[11px] text-red-500 underline disabled:opacity-40"
        >
          {working ? "削除中..." : "完全に削除する"}
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
  );
}
