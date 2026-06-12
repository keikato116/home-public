import { NextResponse } from "next/server";
import { fetchEventsFromAllCalendars, filterByColors } from "@/lib/server/google";

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

    const events = filterByColors(rawEvents as { colorId?: string }[], selectedColors);

    return NextResponse.json({ events });
  } catch {
    clearTimeout(abortTimer);
    return NextResponse.json({ error: "Failed to fetch calendar" }, { status: 500 });
  }
}
