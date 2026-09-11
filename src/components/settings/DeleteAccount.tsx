"use client";

import { useState } from "react";
import { useAuthStore } from "@/store/authStore";

// アカウント削除（App Store Guideline 5.1.1(v)）。
// 「サポートに連絡してください」ではダメで、アプリ内で完結する必要がある。
//
// 誤操作で消えないよう、確認画面で何が消えるかを明示してから実行する。

export function DeleteAccount() {
  const { memberCount, signOut } = useAuthStore();
  const [confirming, setConfirming] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");

  const solo = memberCount !== null && memberCount <= 1;

  const remove = async () => {
    setWorking(true);
    setError("");
    try {
      const res = await fetch("/api/account", { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "failed to delete account");
      }
      // 削除済みユーザーのセッションを残さない。サインアウト後は
      // 読み込み直して、まっさらなサインイン画面に戻す。
      await signOut();
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
    <div className="space-y-3">
      <p className="text-[13px]">アカウントを削除しますか？</p>
      <p className="text-[11px] text-muted-foreground leading-relaxed">
        {solo
          ? "予定・やること・買い物リスト・レシピ・献立・精算記録を含む、この世帯のデータがすべて削除されます。"
          : "あなたのアカウントと個人のデータが削除されます。世帯に残るパートナーのデータは削除されません。"}
        <br />
        削除すると元に戻せません。
      </p>
      <p className="text-[11px] text-muted-foreground leading-relaxed">
        有料プランに加入している場合は、iPhone の「設定 → Apple ID → サブスクリプション」から
        別途、解約の手続きをしてください。アカウントを削除しても自動更新は止まりません。
      </p>
      {error && <p className="text-[11px] text-red-500">{error}</p>}
      <div className="flex gap-4">
        <button
          onClick={remove}
          disabled={working}
          className="text-[11px] text-red-500 underline disabled:opacity-50"
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
