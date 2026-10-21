"use client";

import { useSubscriptionStore } from "@/store/subscriptionStore";
import { useAuthStore } from "@/store/authStore";
import { MANAGE_SUBSCRIPTION_URL, PAIR_LAPSE_NOTICE } from "@/lib/constants";

// プレミアムタブは未購入だと丸ごと隠れるので、購入への導線はここが唯一になる。
// 設定から必ず購入・復元できること、解約導線が示されていることが審査上の必須要件。

export function SubscriptionSettings() {
  const { entitled, source, partnerReady, setPaywallOpen, restore, restoring } = useSubscriptionStore();
  const memberCount = useAuthStore((s) => s.memberCount);
  const paired = memberCount !== null && memberCount > 1;

  // 解約の導線は、自分が App Store で払っている（か、まだ判定できていない）ときだけ。
  // 付与されている人に解約画面を見せても、そこには何も無い。
  const manageLink = (source === "subscription" || (source === null && entitled === true)) && (
    <a
      href={MANAGE_SUBSCRIPTION_URL}
      target="_blank"
      rel="noreferrer"
      className="inline-block text-[11px] text-muted-foreground underline"
    >
      サブスクリプションを管理・解約
    </a>
  );

  return (
    <div className="space-y-3">
      <p className="text-[10px] tracking-widest text-muted-foreground uppercase">premium</p>

      {entitled ? (
        <>
          <p className="text-[13px]">ご利用中</p>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            {source === "grant"
              ? "特別にご招待しています。お支払いは不要です。"
              : "レシピと献立カレンダーが使えます。"}
          </p>
          {manageLink}
        </>
      ) : source !== null ? (
        // 自分は権利を持っているが、相手がまだ。2人とも揃うまで開かない。
        <>
          <p className="text-[13px]">お相手の加入待ち</p>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            {source === "grant" ? "あなたには有料プランを特別にご招待しています。" : "あなたは加入済みです。"}
            2人で使う場合は、お相手も加入すると、レシピと献立カレンダーが使えるようになります。
          </p>
          {manageLink}
        </>
      ) : (
        <>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            レシピの保存・URL 取り込み・献立カレンダーの保存が使えるようになります。
            {paired && (partnerReady
              ? "お相手は加入済みです。あなたも加入すると、2人とも使えるようになります。"
              : "2人で使う場合は、2人とも加入が必要です。")}
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

      {paired && (
        <p className="text-[11px] text-muted-foreground leading-relaxed">{PAIR_LAPSE_NOTICE}</p>
      )}
    </div>
  );
}
