"use client";

import { create } from "zustand";
import type { PurchasesPackage } from "@revenuecat/purchases-capacitor";
import { createClient } from "@/lib/supabase/client";
import { ensureSession } from "@/lib/supabase/helpers";
import { getJSON, setJSON } from "@/lib/storage";
import { LS_ENTITLED_CACHE } from "@/lib/constants";
import {
  purchasesAvailable, configurePurchases, fetchPackages, fetchTrialEligibility,
  purchasePackage, restorePurchases, hasEntitlement, isUserCancelled,
} from "@/lib/purchases";

// 課金状態の正は Supabase の subscriptions テーブル（RevenueCat webhook が書く）。
// StoreKit の customerInfo は、購入直後に webhook が届くまでの数秒を埋める先読みにだけ使う。
//
// localStorage のキャッシュは「起動直後にタブが一瞬消える」のを防ぐためだけのもの。
// 書き換えられても DB 側の RLS があるので、有料データが漏れるわけではない。

/**
 * 自分の権利。DB の premium_source() と同じ値。
 * - subscription: App Store で購入している
 * - grant:        運営が付与している（supabase/migrations/2026-10-21_premium_grants.sql）
 *
 * 2人で使う世帯では、2人とも権利を持っていないと有料機能は開かない。
 */
export type PremiumSource = "subscription" | "grant";

interface SubscriptionState {
  /** 世帯で有料機能が開いているか。null = 判定前。確定するまでプレミアムタブは出さない。 */
  entitled: boolean | null;
  /** 自分の権利。null = 持っていない、または未取得。解約の案内を出すかの判断に使う。 */
  source: PremiumSource | null;
  /** 自分以外の世帯メンバーが全員権利を持っているか。1人世帯なら true。 */
  partnerReady: boolean;
  packages: PurchasesPackage[];
  /** 商品ID → 無料体験の対象か。確定していない商品は入らない（= 出さない）。 */
  trialEligible: Record<string, boolean>;
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

interface DbStatus {
  entitled: boolean;
  source: PremiumSource | null;
  partnerReady: boolean;
}

async function fetchFromDb(): Promise<DbStatus> {
  const supabase = createClient();
  await ensureSession();
  // entitled は RLS の課金ゲート（household_entitled）と同じ判定なので、
  // true なら書き込みも通る。
  const { data, error } = await supabase.rpc("premium_status");
  if (error) {
    // マイグレーション（2026-10-21_premium_grants.sql）を流す前のデプロイでも
    // 有料機能が消えないように、古い関数で判定する。自分の権利は分からないので
    // source は null のまま（解約の案内は安全側で出る）。流し終えたらこの分岐は通らない。
    if (error.code === "PGRST202") {
      const legacy = await supabase.rpc("household_entitled");
      if (legacy.error) throw legacy.error;
      return { entitled: legacy.data === true, source: null, partnerReady: true };
    }
    throw error;
  }
  const d = (data ?? {}) as { own?: unknown; partner_ready?: unknown; entitled?: unknown };
  const source = d.own === "subscription" || d.own === "grant" ? d.own : null;
  return { entitled: d.entitled === true, source, partnerReady: d.partner_ready !== false };
}

export const useSubscriptionStore = create<SubscriptionState>((set, get) => ({
  entitled: null,
  source: null,
  partnerReady: true,
  packages: [],
  trialEligible: {},
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
        // 失敗しても購入はできる。無料体験の表示が出ないだけ。
        fetchTrialEligibility(pkgs.map((p) => p.product.identifier))
          .then((trialEligible) => set({ trialEligible }))
          .catch(() => {});
      } catch {
        // 課金プラグインが落ちても、DB 側の判定でアプリは成立する
      }
    }

    await get().refresh();
  },

  refresh: async () => {
    try {
      const { entitled, source, partnerReady } = await fetchFromDb();
      setJSON(LS_ENTITLED_CACHE, entitled);
      set({ entitled, source, partnerReady });
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
        // 自分の購入だけでは開かない場合がある（2人世帯で相手が未加入）。
        // 先読みで開けてよいのは、相手がすでに権利を持っているときだけ。
        const entitled = get().partnerReady;
        setJSON(LS_ENTITLED_CACHE, entitled);
        set({ entitled, source: "subscription", paywallOpen: false });
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
        // 自分の購入だけでは開かない場合がある（2人世帯で相手が未加入）。
        // 先読みで開けてよいのは、相手がすでに権利を持っているときだけ。
        const entitled = get().partnerReady;
        setJSON(LS_ENTITLED_CACHE, entitled);
        set({ entitled, source: "subscription", paywallOpen: false });
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
