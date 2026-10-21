import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { exitLapsedPartners } from "@/lib/server/lapseExit";
import { BILLING_ENABLED } from "@/lib/constants";

// 払っている人がアプリを開いたとき、相手の権利が切れていれば相手を自動で抜く
// （= 払っている人は自動でソロになる）。ふだんは RevenueCat の webhook が
// 期限切れの時点で同じことをするので、ここは取りこぼしと運営の付与の期限切れ用。
//
// 課金をオフにしている間は何もしない。付与を1人ずつ入れている途中で
// 呼ばれると、まだ付与していない相手を追い出してしまう。

export async function POST() {
  if (!BILLING_ENABLED) return NextResponse.json({ ok: true, exited: 0 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY not configured" }, { status: 503 });
  }

  try {
    const exited = await exitLapsedPartners(admin, user.id);
    return NextResponse.json({ ok: true, exited });
  } catch (e) {
    console.error("[enforce-pair] failed", e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
