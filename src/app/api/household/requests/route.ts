import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  JOIN_REQUEST_TTL_MS, JoinError, addMemberToHousehold, assertCanJoin, membershipOf,
} from "@/lib/server/householdJoin";

// 参加の申請を見る・承認する（src/lib/server/householdJoin.ts）。
//
// GET  … 自分の世帯に届いている申請（incoming）と、自分が出している申請（outgoing）
// POST … { action: "approve" | "decline", requester_id }  世帯にいる人が申請に答える
//        { action: "cancel" }                            自分の申請を取り消す
//
// 申請した人について世帯の人に見せるのは、表示名とログインに使ったメールアドレスだけ。
// 承認するかどうかを決めるのに、だれからの申請か分かる必要があるため。

async function caller() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  const admin = createAdminClient();
  if (!admin) {
    return { error: NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY not configured" }, { status: 503 }) };
  }
  return { user, admin };
}

const fresh = (createdAt: string) => Date.now() - Date.parse(createdAt) < JOIN_REQUEST_TTL_MS;

export async function GET() {
  const ctx = await caller();
  if (ctx.error) return ctx.error;
  const { user, admin } = ctx;

  try {
    const householdId = await membershipOf(admin, user.id);

    // 期限切れの申請は消しておく
    await admin
      .from("join_requests")
      .delete()
      .lt("created_at", new Date(Date.now() - JOIN_REQUEST_TTL_MS).toISOString());

    const { data: mine } = await admin
      .from("join_requests")
      .select("household_id, created_at")
      .eq("requester_id", user.id)
      .maybeSingle();
    let outgoing: { created_at: string; returning: boolean } | null = null;
    if (mine && fresh(mine.created_at as string)) {
      const { data: pause } = await admin
        .from("room_pauses")
        .select("user_id")
        .eq("household_id", mine.household_id)
        .eq("user_id", user.id)
        .maybeSingle();
      outgoing = { created_at: mine.created_at as string, returning: !!pause };
    }

    let incoming: { requester_id: string; name: string; email: string | null; returning: boolean; created_at: string }[] = [];
    if (householdId) {
      const { data: reqs } = await admin
        .from("join_requests")
        .select("requester_id, created_at")
        .eq("household_id", householdId)
        .order("created_at", { ascending: true });
      const live = (reqs ?? []).filter((r) => fresh(r.created_at as string));
      incoming = await Promise.all(
        live.map(async (r) => {
          const id = r.requester_id as string;
          const [{ data: profile }, { data: account }, { data: pause }] = await Promise.all([
            admin.from("member_profiles").select("display_name").eq("user_id", id).maybeSingle(),
            admin.auth.admin.getUserById(id),
            admin.from("room_pauses").select("user_id").eq("household_id", householdId).eq("user_id", id).maybeSingle(),
          ]);
          return {
            requester_id: id,
            name: ((profile?.display_name as string | undefined) ?? "").trim(),
            email: account?.user?.email ?? null,
            returning: !!pause,
            created_at: r.created_at as string,
          };
        })
      );
    }

    return NextResponse.json({ household_id: householdId, incoming, outgoing });
  } catch (e) {
    console.error("[requests] list failed", e);
    return NextResponse.json({ error: "failed to load requests" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const ctx = await caller();
  if (ctx.error) return ctx.error;
  const { user, admin } = ctx;

  const body = (await request.json().catch(() => ({}))) as { action?: unknown; requester_id?: unknown };

  try {
    if (body.action === "cancel") {
      await admin.from("join_requests").delete().eq("requester_id", user.id);
      return NextResponse.json({ ok: true });
    }

    const requesterId = typeof body.requester_id === "string" ? body.requester_id : "";
    if (!requesterId || (body.action !== "approve" && body.action !== "decline")) {
      return NextResponse.json({ error: "invalid request" }, { status: 400 });
    }

    // 答えられるのは、申請先の世帯にいる人だけ
    const householdId = await membershipOf(admin, user.id);
    const { data: req } = await admin
      .from("join_requests")
      .select("household_id, created_at")
      .eq("requester_id", requesterId)
      .maybeSingle();
    if (!householdId || !req || req.household_id !== householdId || !fresh(req.created_at as string)) {
      return NextResponse.json({ error: "request not found" }, { status: 404 });
    }

    if (body.action === "decline") {
      await admin.from("join_requests").delete().eq("requester_id", requesterId).eq("household_id", householdId);
      return NextResponse.json({ ok: true });
    }

    // 申請から承認までに状況が変わっていないか、もう一度確かめる
    await assertCanJoin(admin, householdId, requesterId);
    await addMemberToHousehold(admin, householdId, requesterId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof JoinError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error("[requests] answer failed", e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
