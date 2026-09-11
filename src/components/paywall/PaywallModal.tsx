"use client";

import { useSubscriptionStore } from "@/store/subscriptionStore";
import { purchasesAvailable } from "@/lib/purchases";
import { TERMS_URL, PRIVACY_URL } from "@/lib/constants";
import { X } from "lucide-react";

// 購入画面。App Store の審査要件（3.1.2 / 3.1.1）を満たすために、
// プラン名・期間・価格・自動更新の説明・「購入を復元」・利用規約・プライバシーポリシー
// をすべて同じ画面に置いている。どれかを消すとリジェクト理由になる。

const FEATURES = [
  "レシピの保存と検索",
  "URL からのレシピ自動取り込み",
  "献立カレンダーの保存",
  "作った回数の記録",
];

export function PaywallModal() {
  const {
    paywallOpen, setPaywallOpen, packages, purchase, restore,
    purchasing, restoring, error,
  } = useSubscriptionStore();

  if (!paywallOpen) return null;

  const busy = purchasing || restoring;

  return (
    <div className="fixed inset-0 z-50 bg-background overflow-y-auto">
      <div className="max-w-xl mx-auto px-7 py-8 space-y-8">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[10px] tracking-widest text-muted-foreground uppercase">premium</p>
            <h2 className="text-[22px] tracking-wide">レシピと献立</h2>
          </div>
          <button
            onClick={() => setPaywallOpen(false)}
            className="text-muted-foreground hover:text-foreground transition-colors pt-1"
            aria-label="閉じる"
          >
            <X size={16} />
          </button>
        </div>

        <ul className="space-y-2">
          {FEATURES.map((f) => (
            <li key={f} className="flex items-baseline gap-2 text-[13px]">
              <span className="w-1 h-1 rounded-full bg-foreground/50 flex-shrink-0" />
              {f}
            </li>
          ))}
        </ul>

        {!purchasesAvailable() ? (
          <p className="text-[12px] text-muted-foreground leading-relaxed">
            購入は iPhone アプリからのみ行えます。App Store から home をインストールしてご購入ください。
          </p>
        ) : packages.length === 0 ? (
          <p className="text-[12px] text-muted-foreground">プランを読み込めませんでした。通信環境を確認してもう一度お試しください。</p>
        ) : (
          <div className="space-y-2">
            {packages.map((pkg) => (
              <button
                key={pkg.identifier}
                disabled={busy}
                onClick={() => purchase(pkg)}
                className="w-full flex items-center justify-between px-5 py-4 border border-border rounded-2xl disabled:opacity-50 transition-colors hover:border-foreground/40"
              >
                <span className="text-[13px] tracking-wide">{pkg.product.title}</span>
                <span className="text-[13px]">{pkg.product.priceString}</span>
              </button>
            ))}
          </div>
        )}

        {error && <p className="text-[11px] text-red-500">{error}</p>}

        <button
          onClick={restore}
          disabled={busy || !purchasesAvailable()}
          className="text-[11px] text-muted-foreground underline disabled:opacity-50"
        >
          {restoring ? "復元中..." : "購入を復元"}
        </button>

        <div className="space-y-3 pt-2 border-t border-border">
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            お支払いは購入確定時に Apple ID に請求されます。期間終了の 24 時間前までに解約しない限り自動更新され、
            同額が請求されます。解約は iPhone の「設定 → Apple ID → サブスクリプション」からいつでも行えます。
          </p>
          <div className="flex gap-4">
            <a href={TERMS_URL} target="_blank" rel="noreferrer" className="text-[10px] text-muted-foreground underline">
              利用規約
            </a>
            <a href={PRIVACY_URL} target="_blank" rel="noreferrer" className="text-[10px] text-muted-foreground underline">
              プライバシーポリシー
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
