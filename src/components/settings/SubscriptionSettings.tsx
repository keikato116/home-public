"use client";

import { useSubscriptionStore } from "@/store/subscriptionStore";
import { MANAGE_SUBSCRIPTION_URL } from "@/lib/constants";

// プレミアムタブは未購入だと丸ごと隠れるので、購入への導線はここが唯一になる。
// 設定から必ず購入・復元できること、解約導線が示されていることが審査上の必須要件。

export function SubscriptionSettings() {
  const { entitled, setPaywallOpen, restore, restoring } = useSubscriptionStore();

  return (
    <div className="space-y-3">
      <p className="text-[10px] tracking-widest text-muted-foreground uppercase">premium</p>

      {entitled ? (
        <>
          <p className="text-[13px]">ご利用中</p>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            レシピと献立カレンダーが使えます。世帯のもう1人も同じ機能を使えます。
          </p>
          <a
            href={MANAGE_SUBSCRIPTION_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-block text-[11px] text-muted-foreground underline"
          >
            サブスクリプションを管理・解約
          </a>
        </>
      ) : (
        <>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            レシピの保存・URL 取り込み・献立カレンダーの保存が使えるようになります。
          </p>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setPaywallOpen(true)}
              className="px-5 py-2 bg-foreground text-background text-[11px] tracking-wider rounded-full"
            >
              プランを見る
            </button>
            <button
              onClick={restore}
              disabled={restoring}
              className="text-[11px] text-muted-foreground underline disabled:opacity-50"
            >
              {restoring ? "復元中..." : "購入を復元"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
