import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { JoinError, assertCanJoin, membershipOf, recordJoinAttempt } from "@/lib/server/householdJoin";

// 世帯への参加を申請する（承認制。src/lib/server/householdJoin.ts）。
//
//   { invite_code }          … 相手から聞いた招待コードで申請する
//   { return_to_paused: true } … 課金切れで抜けた前の部屋に、戻る申請を出す。
//                               コードは使わず、アカウントで見分ける（room_pauses）
//
// ここでは世帯に入らない。世帯にいる人が /api/household/requests で承認したときに入る。
// 1人が同時に出せる申請は1つで、出し直すと上書きになる。

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY not configured" }, { status: 503 });
  }

  const body = (await request.json().catch(() => ({}))) as { invite_code?: unknown; return_to_paused?: unknown };

  try {
    let targetId: string | null = null;

    if (body.return_to_paused === true) {
      const { data: pause } = await admin
        .from("room_pauses")
        .select("household_id")
        .eq("user_id", user.id)
        .order("paused_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      targetId = (pause?.household_id as string | undefined) ?? null;
      if (!targetId) throw new JoinError(404, "no previous household");
    } else {
      const code = String(body.invite_code ?? "").trim().toUpperCase();
      if (!code) return NextResponse.json({ error: "invite_code required" }, { status: 400 });

      // 総当たり対策。コードで探すときだけ数える
      await recordJoinAttempt(admin, user.id);

      const { data: target } = await admin
        .from("households")
        .select("id")
        .eq("invite_code", code)
        .maybeSingle();
      if (!target) throw new JoinError(404, "invite code not found");
      targetId = target.id as string;
    }

    if ((await membershipOf(admin, user.id)) === targetId) {
      return NextResponse.json({ ok: true, already_member: true });
    }

    await assertCanJoin(admin, targetId, user.id);

    const { error } = await admin.from("join_requests").upsert({
      requester_id: user.id,
      household_id: targetId,
      created_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true, requested: true });
  } catch (e) {
    if (e instanceof JoinError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error("[join] failed", e);
    return NextResponse.json({ error: "failed to request" }, { status: 500 });
  }
}
