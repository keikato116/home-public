import { NextResponse } from "next/server";

type CalInfo = { id: string; backgroundColor?: string; selected?: boolean; accessRole?: string };

async function fetchEventsFromAllCalendars(
  accessToken: string,
  timeMin: string,
  timeMax?: string,
  signal?: AbortSignal
): Promise<{ events: object[]; error?: string; status?: number }> {
  // Step 1: get all calendars the user has selected
  const calListRes = await fetch(
    "https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=50",
    { headers: { Authorization: `Bearer ${accessToken}` }, signal }
  );
  if (calListRes.status === 401) return { events: [], error: "TOKEN_EXPIRED", status: 401 };
  if (!calListRes.ok) return { events: [], error: "Calendar API error", status: calListRes.status };

  const calListData = await calListRes.json();
  const calendars: CalInfo[] = (calListData.items ?? []).filter(
    (c: CalInfo) => c.selected !== false && c.accessRole !== "freeBusyReader"
  );

  // Step 2: fetch events from all calendars in parallel
  const eventArrays = await Promise.all(
    calendars.map(async (cal) => {
      try {
        const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(cal.id)}/events`);
        url.searchParams.set("timeMin", timeMin);
        if (timeMax) url.searchParams.set("timeMax", timeMax);
        url.searchParams.set("singleEvents", "true");
        url.searchParams.set("orderBy", "startTime");
        url.searchParams.set("maxResults", "250");
        const res = await fetch(url.toString(), {
          headers: { Authorization: `Bearer ${accessToken}` },
          signal,
        });
        if (!res.ok) return [];
        const data = await res.json();
        return (data.items ?? []).map((e: object) => ({ ...e, calendarColor: cal.backgroundColor }));
      } catch { return []; }
    })
  );

  // Step 3: deduplicate by event ID (same event can appear in multiple calendars)
  const seen = new Set<string>();
  const events: object[] = [];
  for (const arr of eventArrays) {
    for (const ev of arr as { id?: string }[]) {
      if (ev.id && seen.has(ev.id)) continue;
      if (ev.id) seen.add(ev.id);
      events.push(ev);
    }
  }

  return { events };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from") ?? new Date().toISOString().split("T")[0];
  const to = searchParams.get("to");
  const colorsParam = searchParams.get("colors") ?? "";
  const selectedColors = colorsParam ? colorsParam.split(",").filter(Boolean) : [];

  const authHeader = request.headers.get("Authorization");
  const accessToken = authHeader?.replace("Bearer ", "");
  if (!accessToken) return NextResponse.json({ error: "No access token" }, { status: 401 });

  const abort = new AbortController();
  const abortTimer = setTimeout(() => abort.abort(), 12000);

  try {
    const timeMin = new Date(from).toISOString();
    const timeMax = to ? new Date(to).toISOString() : undefined;

    const { events: rawEvents, error, status } = await fetchEventsFromAllCalendars(
      accessToken, timeMin, timeMax, abort.signal
    );
    clearTimeout(abortTimer);

    if (error) return NextResponse.json({ error }, { status: status ?? 500 });

    let events = rawEvents as { colorId?: string }[];
    if (selectedColors.length > 0) {
      events = events.filter((e) => !e.colorId || selectedColors.includes(e.colorId));
    }

    return NextResponse.json({ events });
  } catch {
    clearTimeout(abortTimer);
    return NextResponse.json({ error: "Failed to fetch calendar" }, { status: 500 });
  }
}
