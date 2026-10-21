"use client";

import { Capacitor } from "@capacitor/core";
import { Purchases, INTRO_ELIGIBILITY_STATUS } from "@revenuecat/purchases-capacitor";
import type { PurchasesPackage, CustomerInfo } from "@revenuecat/purchases-capacitor";
import { RC_ENTITLEMENT_ID, BILLING_ENABLED } from "@/lib/constants";

// RevenueCat（StoreKit のラッパー）への薄い入口。
//
// import は静的にしている。以前は動的 import だったが、通知のプラグインで
// 同じ書き方をしたところ、WKWebView でチャンクの読み込みが返ってこず、
// 呼び出しが永久に止まった（notifications.ts 参照）。購入ボタンでそれが起きると
// 「押しても何も起きない」になり、審査で落ちる。
//
// 静的 import でもブラウザで落ちることはない。このプラグインは registerPlugin で
// 登録されていて、web 実装は呼ばれたときに初めて読まれる。こちらは
// purchasesAvailable() が false のブラウザでは一切呼ばない。
// ブラウザでは常に「未購入」として振る舞い、購入は iOS アプリ内でだけ行える。

export function purchasesAvailable(): boolean {
  // BILLING_ENABLED が false の間は、ネイティブでも購入まわりを初期化しない。
  // 商品が未登録の状態で RevenueCat を呼ぶと空のペイウォールが出てしまう。
  return BILLING_ENABLED && Capacitor.isNativePlatform();
}

let configured = false;

/**
 * RevenueCat を Supabase の user_id で初期化する。
 * app_user_id = Supabase user_id にしておくことで、webhook 側が
 * どのユーザーの課金かを引き当てられる（匿名IDのままだと紐付かない）。
 */
export async function configurePurchases(userId: string): Promise<void> {
  if (!purchasesAvailable()) return;
  const apiKey = process.env.NEXT_PUBLIC_REVENUECAT_IOS_API_KEY;
  if (!apiKey) return;

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
    await Purchases.logOut();
  } catch {
    // 匿名IDのままだと logOut は失敗する。サインアウトを妨げる理由はない。
  }
}

/** 販売中のプラン（月額・年額）。ネイティブ以外では空。 */
export async function fetchPackages(): Promise<PurchasesPackage[]> {
  if (!purchasesAvailable()) return [];
  const offerings = await Purchases.getOfferings();
  return offerings.current?.availablePackages ?? [];
}

/**
 * 無料体験の対象になる商品ID。StoreKit が「対象」と確定させたものだけを返す。
 * 不明（UNKNOWN）は対象外として扱う。対象外の人に「無料」と見せると、
 * 押した瞬間に課金されて誤認させることになるため。
 */
export async function fetchTrialEligibility(productIds: string[]): Promise<Record<string, boolean>> {
  if (!purchasesAvailable() || productIds.length === 0) return {};
  const res = await Purchases.checkTrialOrIntroductoryPriceEligibility({ productIdentifiers: productIds });
  const out: Record<string, boolean> = {};
  for (const id of productIds) {
    out[id] = res[id]?.status === INTRO_ELIGIBILITY_STATUS.INTRO_ELIGIBILITY_STATUS_ELIGIBLE;
  }
  return out;
}

export async function purchasePackage(pkg: PurchasesPackage): Promise<CustomerInfo> {
  const { customerInfo } = await Purchases.purchasePackage({ aPackage: pkg });
  return customerInfo;
}

export async function restorePurchases(): Promise<CustomerInfo> {
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
