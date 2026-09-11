import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

// RevenueCat webhook → subscriptions テーブル。
// 課金状態の唯一の正はこのテーブル。クライアントの customerInfo は表示の先読みにしか使わない
// （WebView は差し替え可能なので、クライアントの申告を信用してはいけない）。
//
// RevenueCat ダッシュボード > Integrations > Webhooks に登録する:
//   URL:               https://<deploy>/api/revenuecat/webhook
//   Authorization header: REVENUECAT_WEBHOOK_SECRET と同じ値

type RcEvent = {
  id?: string;
  type?: string;
  app_user_id?: string;
  original_app_user_id?: string;
  product_id?: string;
  expiration_at_ms?: number | null;
  environment?: string;
};

// RevenueCat のイベント種別 → こちらで持つ status。
// CANCELLATION は「自動更新を止めた」だけで期限までは使えるので active のまま
// （expiration_at_ms が入っているので、期限が来れば判定側で自然に落ちる）。
function statusFor(type: string): "active" | "in_grace" | "expired" | null {
  switch (type) {
    case "INITIAL_PURCHASE":
    case "RENEWAL":
    case "UNCANCELLATION":
    case "PRODUCT_CHANGE":
    case "NON_RENEWING_PURCHASE":
    case "CANCELLATION":
    case "TEMPORARY_ENTITLEMENT_GRANT":
      return "active";
    case "BILLING_ISSUE":
      return "in_grace";
    case "EXPIRATION":
    case "REFUND":
    case "SUBSCRIPTION_PAUSED":
      return "expired";
    default:
      // TRANSFER / SUBSCRIBER_ALIAS など、状態を変えないイベント
      return null;
  }
}

export async function POST(req: NextRequest) {
  const secret = process.env.REVENUECAT_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "REVENUECAT_WEBHOOK_SECRET not configured" }, { status: 503 });
  }
  if (req.headers.get("authorization") !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY not configured" }, { status: 503 });
  }

  let event: RcEvent;
  try {
    const body = await req.json();
    event = (body?.event ?? {}) as RcEvent;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const userId = event.app_user_id ?? event.original_app_user_id;
  const type = event.type ?? "";
  if (!userId || !type) {
    return NextResponse.json({ error: "missing app_user_id or type" }, { status: 400 });
  }

  const status = statusFor(type);
  // 状態を変えないイベントも 200 で返す。4xx を返すと RevenueCat が再送し続ける。
  if (!status) return NextResponse.json({ ok: true, skipped: type });

  // 匿名 ID（$RCAnonymousID:…）は Supabase ユーザーに紐付かない。購入前に
  // Purchases.logIn() が走っていないケースなので、記録せず 200 を返す。
  if (!/^[0-9a-f-]{36}$/i.test(userId)) {
    return NextResponse.json({ ok: true, skipped: "anonymous app_user_id" });
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey,
    { cookies: { getAll: () => [], setAll: () => {} } }
  );

  const { error } = await supabase.from("subscriptions").upsert(
    {
      user_id: userId,
      product_id: event.product_id ?? null,
      status,
      expires_at: event.expiration_at_ms ? new Date(event.expiration_at_ms).toISOString() : null,
      environment: event.environment ?? null,
      event_id: event.id ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  if (error) {
    // 5xx で返すと RevenueCat が再送してくれる
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
