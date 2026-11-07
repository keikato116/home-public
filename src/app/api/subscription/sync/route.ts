import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncSubscriptionFromRevenueCat } from "@/lib/server/revenuecatSync";

// ログイン中の本人の課金状態を、RevenueCat に直接問い合わせて直す。
// アプリが「StoreKit では購入済みなのに、サーバーの判定は未加入」に気づいたときに呼ぶ。
// 問い合わせるのは本人の ID だけ（他人の状態は触れない）。
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY not configured" }, { status: 503 });
  }

  try {
    const result = await syncSubscriptionFromRevenueCat(admin, user.id);
    return NextResponse.json({ result });
  } catch (e) {
    console.error("[subscription/sync] failed", e);
    return NextResponse.json({ error: "sync failed" }, { status: 502 });
  }
}
