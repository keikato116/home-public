"use client";

import { create } from "zustand";
import type { PurchasesPackage } from "@revenuecat/purchases-capacitor";
import { createClient } from "@/lib/supabase/client";
import { ensureSession } from "@/lib/supabase/helpers";
import { getJSON, setJSON } from "@/lib/storage";
import { LS_ENTITLED_CACHE } from "@/lib/constants";
import {
  purchasesAvailable, configurePurchases, fetchPackages,
  purchasePackage, restorePurchases, hasEntitlement, isUserCancelled,
} from "@/lib/purchases";

// 課金状態の正は Supabase の subscriptions テーブル（RevenueCat webhook が書く）。
// StoreKit の customerInfo は、購入直後に webhook が届くまでの数秒を埋める先読みにだけ使う。
//
// localStorage のキャッシュは「起動直後にタブが一瞬消える」のを防ぐためだけのもの。
// 書き換えられても DB 側の RLS があるので、有料データが漏れるわけではない。

interface SubscriptionState {
  /** null = 判定前。true/false が確定するまでプレミアムタブは出さない。 */
  entitled: boolean | null;
  packages: PurchasesPackage[];
  paywallOpen: boolean;
  purchasing: boolean;
  restoring: boolean;
  error: string | null;

  init: (userId: string) => Promise<void>;
  refresh: () => Promise<void>;
  setPaywallOpen: (open: boolean) => void;
  purchase: (pkg: PurchasesPackage) => Promise<boolean>;
  restore: () => Promise<boolean>;
}

async function fetchEntitlementFromDb(): Promise<boolean> {
  const supabase = createClient();
  await ensureSession();
  const { data, error } = await supabase.rpc("household_entitled");
  if (error) throw error;
  return data === true;
}

export const useSubscriptionStore = create<SubscriptionState>((set, get) => ({
  entitled: null,
  packages: [],
  paywallOpen: false,
  purchasing: false,
  restoring: false,
  error: null,

  init: async (userId) => {
    // 前回の判定を先に出して、起動時にタブがちらつかないようにする
    const cached = getJSON<boolean | null>(LS_ENTITLED_CACHE, null);
    if (cached !== null) set({ entitled: cached });

    if (purchasesAvailable()) {
      try {
        await configurePurchases(userId);
        const pkgs = await fetchPackages();
        set({ packages: pkgs });
      } catch {
        // 課金プラグインが落ちても、DB 側の判定でアプリは成立する
      }
    }

    await get().refresh();
  },

  refresh: async () => {
    try {
      const entitled = await fetchEntitlementFromDb();
      setJSON(LS_ENTITLED_CACHE, entitled);
      set({ entitled });
    } catch {
      // オフライン等。キャッシュがなければ「未購入」に倒す
      if (get().entitled === null) set({ entitled: false });
    }
  },

  setPaywallOpen: (open) => set({ paywallOpen: open, error: null }),

  purchase: async (pkg) => {
    set({ purchasing: true, error: null });
    try {
      const info = await purchasePackage(pkg);
      if (hasEntitlement(info)) {
        // 先読みで即開放。webhook が届けば refresh で DB 由来の値に上書きされる。
        setJSON(LS_ENTITLED_CACHE, true);
        set({ entitled: true, paywallOpen: false });
        setTimeout(() => { get().refresh().catch(() => {}); }, 4000);
        return true;
      }
      set({ error: "購入は完了しましたが、権利を確認できませんでした。時間をおいて『購入を復元』をお試しください。" });
      return false;
    } catch (e) {
      if (!isUserCancelled(e)) {
        set({ error: e instanceof Error ? e.message : "購入に失敗しました" });
      }
      return false;
    } finally {
      set({ purchasing: false });
    }
  },

  restore: async () => {
    set({ restoring: true, error: null });
    try {
      const info = await restorePurchases();
      const ok = hasEntitlement(info);
      if (ok) {
        setJSON(LS_ENTITLED_CACHE, true);
        set({ entitled: true, paywallOpen: false });
        setTimeout(() => { get().refresh().catch(() => {}); }, 4000);
      } else {
        set({ error: "復元できる購入が見つかりませんでした。" });
      }
      return ok;
    } catch (e) {
      set({ error: e instanceof Error ? e.message : "復元に失敗しました" });
      return false;
    } finally {
      set({ restoring: false });
    }
  },
}));
