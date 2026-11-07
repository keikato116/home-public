import type { SupabaseClient } from "@supabase/supabase-js";
import { RC_ENTITLEMENT_ID } from "@/lib/constants";

// RevenueCat に直接「この人はいま権利があるか」を問い合わせて、subscriptions を直す。
//
// ふだん subscriptions を書くのは webhook だが、それだけだと次の場合に記録が欠ける。
//   ・webhook が届かなかった・失敗した（設定ミス、こちらの障害）
//   ・アカウントを作り直して「購入を復元」した。購入は古い ID のままなので、
//     webhook は消えた古い ID あてに届き、新しい ID の行はどこからも作られない
//     （TRANSFER イベントには有効期限が載っていない）
// どちらも「StoreKit では購入済みなのに、アプリを開き直すたびに加入画面」になる。
//
// 秘密キー（REVENUECAT_SECRET_API_KEY、v1 の sk_…）はサーバーだけが持つ。
// クライアントの申告は信用せず、問い合わせる ID もログイン中の本人か webhook が
// 名指しした ID に限る。

const RC_API = "https://api.revenuecat.com/v1/subscribers/";

export interface RcEntitlement {
  expires_date: string | null;
  grace_period_expires_date?: string | null;
  product_identifier?: string;
}

interface RcSubscription {
  is_sandbox?: boolean;
}

export interface RcSubscriber {
  entitlements?: Record<string, RcEntitlement>;
  subscriptions?: Record<string, RcSubscription>;
}

export interface SubscriptionRow {
  product_id: string | null;
  status: "active" | "in_grace" | "expired";
  expires_at: string | null;
  environment: "SANDBOX" | "PRODUCTION";
}

/**
 * RevenueCat の subscriber から subscriptions の行を作る。権利の記録が無ければ null
 * （一度も買っていない人の行を書いて、付与や別の記録を上書きしないため）。
 */
export function subscriptionRowFrom(subscriber: RcSubscriber, now = Date.now()): SubscriptionRow | null {
  const ent = subscriber.entitlements?.[RC_ENTITLEMENT_ID];
  if (!ent) return null;

  const productId = ent.product_identifier ?? null;
  const sandbox = productId ? subscriber.subscriptions?.[productId]?.is_sandbox === true : false;
  const environment = sandbox ? "SANDBOX" : "PRODUCTION";

  const expires = ent.expires_date ? Date.parse(ent.expires_date) : null;
  const grace = ent.grace_period_expires_date ? Date.parse(ent.grace_period_expires_date) : null;

  if (expires === null || expires > now) {
    return { product_id: productId, status: "active", expires_at: ent.expires_date, environment };
  }
  // 支払いに失敗して猶予期間中。判定（member_premium_source）は expires_at を見るので、
  // 猶予の終わりを入れておく
  if (grace !== null && grace > now) {
    return { product_id: productId, status: "in_grace", expires_at: ent.grace_period_expires_date ?? null, environment };
  }
  return { product_id: productId, status: "expired", expires_at: ent.expires_date, environment };
}

export type SyncResult =
  | "not-configured"
  | "no-entitlement"
  | "unknown-user"
  | SubscriptionRow["status"];

/** RevenueCat に問い合わせて、その人の subscriptions の行を書き直す。 */
export async function syncSubscriptionFromRevenueCat(
  admin: SupabaseClient,
  userId: string
): Promise<SyncResult> {
  const key = process.env.REVENUECAT_SECRET_API_KEY;
  if (!key) return "not-configured";

  const res = await fetch(RC_API + encodeURIComponent(userId), {
    headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`revenuecat ${res.status}`);
  const body = (await res.json()) as { subscriber?: RcSubscriber };

  const row = subscriptionRowFrom(body.subscriber ?? {});
  if (!row) return "no-entitlement";

  const { error } = await admin.from("subscriptions").upsert(
    { user_id: userId, ...row, event_id: null, updated_at: new Date().toISOString() },
    { onConflict: "user_id" }
  );
  if (error) {
    // 削除済みのアカウント（auth.users に行が無い）
    if (error.code === "23503") return "unknown-user";
    throw new Error(error.message);
  }
  return row.status;
}
