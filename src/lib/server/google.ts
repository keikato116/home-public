// Server-side Google API helpers shared by /api/calendar, /api/partner-calendar
// and /api/refresh-token.

type CalInfo = { id: string; backgroundColor?: string; selected?: boolean; accessRole?: string };

export async function fetchEventsFromAllCalendars(
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
    (c: CalInfo) => c.selected !== false && c.accessRole !== "freeBusyReader" && !c.id.includes("#holiday@group")
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

/** Keeps events whose colorId is unset or in the selected list. No-op when list is empty. */
export function filterByColors<T extends { colorId?: string }>(events: T[], colors: string[]): T[] {
  if (colors.length === 0) return events;
  return events.filter((e) => !e.colorId || colors.includes(e.colorId));
}

/** Exchanges a Google refresh token for a new access token. */
export async function requestGoogleTokenRefresh(
  refreshToken: string
): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
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
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}
