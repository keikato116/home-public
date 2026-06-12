import { CalendarEvent } from "@/types";

// colorId → color mapping from Google Calendar Colors API v3
export const GOOGLE_COLOR_MAP: Record<string, string> = {
  "1": "Lavender",
  "2": "Sage",
  "3": "Grape",
  "4": "Flamingo",
  "5": "Banana",
  "6": "Tangerine",
  "7": "Peacock",
  "8": "Graphite",
  "9": "Blueberry",
  "10": "Basil",
  "11": "Tomato",
};

export const GOOGLE_COLOR_HEX: Record<string, string> = {
  "1": "#a4bdfc",
  "2": "#7ae28c",
  "3": "#dbadff",
  "4": "#ff887c",
  "5": "#fbd75b",
  "6": "#ffb878",
  "7": "#46d6db",
  "8": "#616161",
  "9": "#5484ed",
  "10": "#51b749",
  "11": "#dc2127",
};

export async function fetchCalendarEvents(
  accessToken: string,
  selectedColors: string[],
  startDate: string,
  toDate?: string
): Promise<CalendarEvent[]> {
  let path = `/api/calendar?from=${encodeURIComponent(startDate)}&colors=${encodeURIComponent(selectedColors.join(","))}`;
  if (toDate) path += `&to=${encodeURIComponent(toDate)}`;
  const res = await fetch(path, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (res.status === 401) throw new Error("TOKEN_EXPIRED");
  if (!res.ok) throw new Error("FETCH_FAILED");
  const data = await res.json();
  return data.events ?? [];
}

export function formatEventTime(event: CalendarEvent): string {
  if (event.start.date && !event.start.dateTime) return "all day";
  if (!event.start.dateTime) return "";
  const d = new Date(event.start.dateTime);
  return d.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
}
