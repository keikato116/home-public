"use client";

import { LogOut } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { SubscriptionSettings } from "@/components/settings/SubscriptionSettings";
import { DeleteAccount } from "@/components/settings/DeleteAccount";
import { PaywallModal } from "@/components/paywall/PaywallModal";

// 権利（購入 or 運営の付与）を持っていない人に出す画面。
//
// すべての機能が有料なので、加入するまで（課金が切れたあとも）できるのは
// 加入・購入の復元だけ。ログアウトとアカウント削除は課金と関係なく必ず残す
// （アカウント削除はアプリ内でできることが App Store の審査要件 5.1.1(v)）。
//
// データは消していない。加入すれば元どおり使える。

export function LockedScreen() {
  const signOut = useAuthStore((s) => s.signOut);

  return (
    <div className="min-h-screen overflow-y-auto bg-background">
      <div className="max-w-xl mx-auto px-7 py-12 space-y-10">
        <div className="space-y-2">
          <p className="text-[10px] tracking-widest text-muted-foreground uppercase">imbrex</p>
          <h1 className="text-[22px] tracking-wide">加入するとはじめられます</h1>
          <p className="text-[12px] text-muted-foreground leading-relaxed">
            Imbrex のすべての機能は、有料プラン（月額300円）でご利用いただけます。
            はじめての方は、最初の1か月が無料です。
            保存したデータは、加入すれば元どおりお使いいただけます。
          </p>
        </div>

        <SubscriptionSettings />

        <div className="border-t border-border pt-6 space-y-6">
          <button
            onClick={signOut}
            className="flex items-center gap-2 text-[11px] text-muted-foreground hover:text-foreground transition-colors tracking-wider"
          >
            <LogOut size={12} />
            sign out
          </button>

          <DeleteAccount />
        </div>
      </div>

      <PaywallModal />
    </div>
  );
}
