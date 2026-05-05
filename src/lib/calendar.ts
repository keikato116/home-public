import { CalendarEvent } from "@/types";

// colorId → color mapping from Google Calendar Colors API v3
export const GOOGLE_COLOR_MAP: Record<string, string> = {
  "1": "ラベンダー",
  "2": "セージ",
  "3": "グレープ",
  "4": "フラミンゴ",
  "5": "バナナ",
  "6": "タンジェリン",
  "7": "ピーコック",
  "8": "グラファイト",
  "9": "ブルーベリー",
  "10": "バジル",
  "11": "トマト",
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

export function getEventDate(event: CalendarEvent): string {
  return (event.start.dateTime ?? event.start.date ?? "").split("T")[0];
}

export function formatEventTime(event: CalendarEvent): string {
  if (event.start.date && !event.start.dateTime) return "終日";
  if (!event.start.dateTime) return "";
  const d = new Date(event.start.dateTime);
  return d.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
}
