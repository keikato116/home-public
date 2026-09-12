"use client";

import { Capacitor } from "@capacitor/core";
import type { PurchasesPackage, CustomerInfo } from "@revenuecat/purchases-capacitor";
import { RC_ENTITLEMENT_ID, BILLING_ENABLED } from "@/lib/constants";

// RevenueCat（StoreKit のラッパー）への薄い入口。
//
// ネイティブ限定のプラグインなので、ブラウザ（PWA / 開発時）では読み込まない。
// import 自体を動的にしているのは、web バンドルに native-only の実装を持ち込むと
// 起動時に "not implemented on web" で落ちるため。
// ブラウザでは常に「未購入」として振る舞い、購入は iOS アプリ内でだけ行える。

export function purchasesAvailable(): boolean {
  // BILLING_ENABLED が false の間は、ネイティブでも購入まわりを初期化しない。
  // 商品が未登録の状態で RevenueCat を呼ぶと空のペイウォールが出てしまう。
  return BILLING_ENABLED && Capacitor.isNativePlatform();
}

let configured = false;

async function plugin() {
  const mod = await import("@revenuecat/purchases-capacitor");
  return mod.Purchases;
}

/**
 * RevenueCat を Supabase の user_id で初期化する。
 * app_user_id = Supabase user_id にしておくことで、webhook 側が
 * どのユーザーの課金かを引き当てられる（匿名IDのままだと紐付かない）。
 */
export async function configurePurchases(userId: string): Promise<void> {
  if (!purchasesAvailable()) return;
  const apiKey = process.env.NEXT_PUBLIC_REVENUECAT_IOS_API_KEY;
  if (!apiKey) return;

  const Purchases = await plugin();
  if (!configured) {
    await Purchases.configure({ apiKey, appUserID: userId });
    configured = true;
    return;
  }
  // 別アカウントでログインし直した場合に app_user_id を移す
  await Purchases.logIn({ appUserID: userId });
}

export async function logOutPurchases(): Promise<void> {
  if (!purchasesAvailable() || !configured) return;
  try {
    const Purchases = await plugin();
    await Purchases.logOut();
  } catch {
    // 匿名IDのままだと logOut は失敗する。サインアウトを妨げる理由はない。
  }
}

/** 販売中のプラン（月額・年額）。ネイティブ以外では空。 */
export async function fetchPackages(): Promise<PurchasesPackage[]> {
  if (!purchasesAvailable()) return [];
  const Purchases = await plugin();
  const offerings = await Purchases.getOfferings();
  return offerings.current?.availablePackages ?? [];
}

export async function purchasePackage(pkg: PurchasesPackage): Promise<CustomerInfo> {
  const Purchases = await plugin();
  const { customerInfo } = await Purchases.purchasePackage({ aPackage: pkg });
  return customerInfo;
}

export async function restorePurchases(): Promise<CustomerInfo> {
  const Purchases = await plugin();
  const { customerInfo } = await Purchases.restorePurchases();
  return customerInfo;
}

/** StoreKit 側で権利が有効か。webhook が届くまでの数秒を埋めるための先読み。 */
export function hasEntitlement(info: CustomerInfo): boolean {
  return Boolean(info.entitlements.active[RC_ENTITLEMENT_ID]);
}

/** ユーザーが購入をキャンセルしただけなのか、本当にエラーなのかを見分ける。 */
export function isUserCancelled(err: unknown): boolean {
  const e = err as { code?: string | number; userCancelled?: boolean; message?: string };
  return (
    e?.userCancelled === true ||
    String(e?.code) === "1" ||
    /cancel/i.test(e?.message ?? "")
  );
}
