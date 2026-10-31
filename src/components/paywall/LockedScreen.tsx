"use client";

import { LogOut } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { DeleteAccount } from "@/components/settings/DeleteAccount";
import { PaywallContent } from "@/components/paywall/PaywallModal";
import { getPendingJoin } from "@/lib/pendingJoin";

// 権利（購入 or 運営の付与）を持っていない人に出す画面。
//
// すべての機能が有料なので、加入するまで（課金が切れたあとも）できるのは
// 加入・購入の復元だけ。ログアウトとアカウント削除は課金と関係なく必ず残す
// （アカウント削除はアプリ内でできることが App Store の審査要件 5.1.1(v)）。
//
// データは消していない。加入すれば元どおり使える。
//
// 購入画面をそのまま載せている。以前は説明だけの画面から「プランを見る」で
// 購入画面を開く2段構えだったが、どちらも同じこと（全機能・1か月無料・300円）を
// 言っていて、価格にたどり着くまでに1回余計に押させていた。

export function LockedScreen() {
  const signOut = useAuthStore((s) => s.signOut);
  const pendingCode = typeof window === "undefined" ? null : getPendingJoin();

  return (
    <div className="min-h-screen overflow-y-auto bg-background">
      <div className="max-w-xl mx-auto px-7 py-12 space-y-10">
        <PaywallContent>
          <div className="space-y-2">
            <p className="text-[12px] text-muted-foreground leading-relaxed">
              Imbrex は加入するとはじめられます。保存したデータは、加入すれば元どおりお使いいただけます。
            </p>
            {pendingCode && (
              <p className="text-[12px] leading-relaxed">
                加入すると、招待コード <span className="tracking-widest font-medium">{pendingCode}</span> の世帯に自動で参加します。
                お相手も加入している必要があります。
              </p>
            )}
          </div>
        </PaywallContent>

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
    </div>
  );
}
