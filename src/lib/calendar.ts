import { CalendarEvent } from "@/types";

export const GOOGLE_COLOR_MAP: Record<string, string> = {
  "1": "トマト",
  "2": "フラミンゴ",
  "3": "タンジェリン",
  "4": "バナナ",
  "5": "セージ",
  "6": "バジル",
  "7": "ピーコック",
  "8": "ブルーベリー",
  "9": "ラベンダー",
  "10": "グレープ",
  "11": "グラファイト",
};

export const GOOGLE_COLOR_HEX: Record<string, string> = {
  "1": "#d50000",
  "2": "#e67c73",
  "3": "#f4511e",
  "4": "#f6bf26",
  "5": "#33b679",
  "6": "#0b8043",
  "7": "#039be5",
  "8": "#3f51b5",
  "9": "#7986cb",
  "10": "#8e24aa",
  "11": "#616161",
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
