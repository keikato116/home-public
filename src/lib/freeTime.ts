import { CalendarEvent } from "@/types";
import { isJapaneseHoliday } from "@/lib/japaneseHolidays";
import { toJSTDateStr, toJSTMinOfDay } from "@/lib/dates";

/** True if any timed event overlaps the [startHour, endHour) JST window. */
export function hasEventInWindow(events: CalendarEvent[], startHour: number, endHour: number): boolean {
  return events.some((ev) => {
    if (!ev.start.dateTime || ev.start.date) return false;
    const startMin = toJSTMinOfDay(ev.start.dateTime);
    // If end date (JST) is later than start date, the event covers the rest of the start day
    if (ev.end.dateTime && toJSTDateStr(ev.end.dateTime) > toJSTDateStr(ev.start.dateTime)) {
      return startMin < endHour * 60;
    }
    const endMin = ev.end.dateTime ? toJSTMinOfDay(ev.end.dateTime) : startMin + 60;
    const spansMidnight = endMin < startMin;
    if (spansMidnight) return startMin < endHour * 60;
    return startMin < endHour * 60 && endMin > startHour * 60;
  });
}

/** True if both household members have an all-day event that day. */
export function bothHaveAllDayEvent(events: CalendarEvent[]): boolean {
  const owners = new Set(
    events.filter(ev => ev.start.date && !ev.start.dateTime && ev.ownerId).map(ev => ev.ownerId!)
  );
  return owners.size >= 2;
}

/** All-day events (e.g. 当直) block free detection except on public holidays. */
export function hasAllDayBlock(date: Date, events: CalendarEvent[]): boolean {
  return !isJapaneseHoliday(date) && events.some(e => e.start.date && !e.start.dateTime);
}
