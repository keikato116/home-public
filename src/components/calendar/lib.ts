import { CalendarEvent } from "@/types";
import { GOOGLE_COLOR_HEX } from "@/lib/calendar";
import { getWeekDays, MONTH_NAMES } from "@/lib/dates";

export type ViewMode = "day" | "week" | "month";

export function eventColor(event: CalendarEvent): string {
  return event.colorId ? GOOGLE_COLOR_HEX[event.colorId] : "#888888";
}

export function parseTaskType(summary: string): "run" | "ride" | null {
  if (summary.startsWith("run:")) return "run";
  if (summary.startsWith("ride:")) return "ride";
  return null;
}

export function getPeriodLabel(viewMode: ViewMode, selectedDate: Date): string {
  if (viewMode === "day") {
    return selectedDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  }
  if (viewMode === "month") {
    return `${MONTH_NAMES[selectedDate.getMonth()]} ${selectedDate.getFullYear()}`;
  }
  const days = getWeekDays(selectedDate);
  const first = days[0];
  const last = days[6];
  if (first.getMonth() === last.getMonth()) {
    return `${MONTH_NAMES[first.getMonth()]} ${first.getFullYear()}`;
  }
  return `${MONTH_NAMES[first.getMonth()].slice(0, 3)} – ${MONTH_NAMES[last.getMonth()].slice(0, 3)} ${last.getFullYear()}`;
}
