import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from") ?? new Date().toISOString().split("T")[0];
  const to = searchParams.get("to");
  const colorsParam = searchParams.get("colors") ?? "";
  const selectedColors = colorsParam ? colorsParam.split(",").filter(Boolean) : [];

  const authHeader = request.headers.get("Authorization");
  const accessToken = authHeader?.replace("Bearer ", "");

  if (!accessToken) {
    return NextResponse.json({ error: "No access token" }, { status: 401 });
  }

  try {
    const timeMin = new Date(from).toISOString();
    const url = new URL("https://www.googleapis.com/calendar/v3/calendars/primary/events");
    url.searchParams.set("timeMin", timeMin);
    if (to) url.searchParams.set("timeMax", new Date(to).toISOString());
    url.searchParams.set("singleEvents", "true");
    url.searchParams.set("orderBy", "startTime");
    url.searchParams.set("maxResults", "250");

    const abort = new AbortController();
    const abortTimer = setTimeout(() => abort.abort(), 9000);
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: abort.signal,
    });
    clearTimeout(abortTimer);

    if (!res.ok) {
      const err = await res.json();
      return NextResponse.json({ error: err.error?.message ?? "Calendar API error" }, { status: res.status });
    }

    const data = await res.json();
    let events = data.items ?? [];

    if (selectedColors.length > 0) {
      // Events without a colorId (default) always pass; filter only applies to explicitly colored events
      events = events.filter((e: { colorId?: string }) =>
        !e.colorId || selectedColors.includes(e.colorId)
      );
    }

    return NextResponse.json({ events });
  } catch {
    return NextResponse.json({ error: "Failed to fetch calendar" }, { status: 500 });
  }
}
