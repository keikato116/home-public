import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { membershipOf, rotateInviteCode } from "@/lib/server/householdJoin";

// 自分の世帯の招待コードを作り直す（設定 → household の「作り直す」）。
// 古いコードで出された申請は、承認しない限り入れないので残しておく。
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY not configured" }, { status: 503 });
  }

  try {
    const householdId = await membershipOf(admin, user.id);
    if (!householdId) return NextResponse.json({ error: "not in a household" }, { status: 400 });
    const invite_code = await rotateInviteCode(admin, householdId);
    return NextResponse.json({ invite_code });
  } catch (e) {
    console.error("[invite-code] rotate failed", e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
