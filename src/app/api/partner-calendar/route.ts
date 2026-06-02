import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

async function refreshGoogleToken(refreshToken: string): Promise<string | null> {
  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.access_token ?? null;
  } catch {
    return null;
  }
}

type CalInfo = { id: string; backgroundColor?: string; selected?: boolean; accessRole?: string };

async function fetchPartnerEvents(
  accessToken: string,
  colors: string[],
  from: string
): Promise<object[] | null> {
  try {
    const timeMin = new Date(from).toISOString();
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), 12000);

    // Get all selected calendars
    const calListRes = await fetch(
      "https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=50",
      { headers: { Authorization: `Bearer ${accessToken}` }, signal: abort.signal }
    );
    if (calListRes.status === 401) { clearTimeout(timer); return null; }
    if (!calListRes.ok) { clearTimeout(timer); return []; }

    const calListData = await calListRes.json();
    const calendars: CalInfo[] = (calListData.items ?? []).filter(
      (c: CalInfo) => c.selected !== false && c.accessRole !== "freeBusyReader"
    );

    // Fetch events from all calendars in parallel
    const eventArrays = await Promise.all(
      calendars.map(async (cal) => {
        try {
          const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(cal.id)}/events`);
          url.searchParams.set("timeMin", timeMin);
          url.searchParams.set("singleEvents", "true");
          url.searchParams.set("orderBy", "startTime");
          url.searchParams.set("maxResults", "250");
          const res = await fetch(url.toString(), {
            headers: { Authorization: `Bearer ${accessToken}` },
            signal: abort.signal,
          });
          if (!res.ok) return [];
          const data = await res.json();
          return (data.items ?? []).map((e: object) => ({ ...e, calendarColor: cal.backgroundColor }));
        } catch { return []; }
      })
    );
    clearTimeout(timer);

    // Deduplicate by event ID
    const seen = new Set<string>();
    let events: { id?: string; colorId?: string }[] = [];
    for (const arr of eventArrays) {
      for (const ev of arr as { id?: string }[]) {
        if (ev.id && seen.has(ev.id)) continue;
        if (ev.id) seen.add(ev.id);
        events.push(ev);
      }
    }

    if (colors.length > 0) {
      events = events.filter((e) => !e.colorId || colors.includes(e.colorId));
    }
    return events;
  } catch {
    return [];
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const householdId = searchParams.get("householdId");
  const from = searchParams.get("from") ?? new Date().toISOString().split("T")[0];

  if (!householdId) {
    return NextResponse.json({ error: "missing householdId" }, { status: 400 });
  }

  // Authenticate caller via Supabase session cookie
  const cookieStore = await cookies();
  const supabaseAnon = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
  const { data: { user } } = await supabaseAnon.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Use service role to bypass RLS
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY not configured" }, { status: 503 });
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey,
    { cookies: { getAll: () => [], setAll: () => {} } }
  );

  // Verify caller is a member of the household
  const { data: membership } = await supabase
    .from("household_members")
    .select("user_id")
    .eq("household_id", householdId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) return NextResponse.json({ error: "not in household" }, { status: 403 });

  // Fetch all partner tokens
  const { data: partners } = await supabase
    .from("user_tokens")
    .select("user_id, google_access_token, google_refresh_token, display_name, calendar_colors")
    .eq("household_id", householdId)
    .neq("user_id", user.id);

  if (!partners || partners.length === 0) {
    return NextResponse.json({ events: [] });
  }

  const allEvents: object[] = [];

  await Promise.allSettled(
    partners.map(async (partner) => {
      const colors: string[] = (partner as { calendar_colors?: string[] | null }).calendar_colors ?? [];
      let token: string | null = partner.google_access_token;
      if (!token && !partner.google_refresh_token) return;

      // Try with current token; if expired, refresh
      let events = token ? await fetchPartnerEvents(token, colors, from) : null;

      if (events === null && partner.google_refresh_token) {
        token = await refreshGoogleToken(partner.google_refresh_token);
        if (token) {
          // Store refreshed token for next time (fire-and-forget)
          void supabase.from("user_tokens")
            .update({ google_access_token: token, updated_at: new Date().toISOString() })
            .eq("user_id", partner.user_id);
          events = await fetchPartnerEvents(token, colors, from);
        }
      }

      if (events && events.length > 0) {
        const ownerName = ((partner.display_name ?? "") as string).split(" ")[0];
        allEvents.push(
          ...events.map((e) => ({ ...e, ownerId: partner.user_id, ownerName }))
        );
      }
    })
  );

  return NextResponse.json({ events: allEvents });
}
