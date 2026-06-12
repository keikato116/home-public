import { isJapaneseHoliday } from "@/lib/japaneseHolidays";

// All times in the app are displayed in JST (UTC+9), regardless of device timezone
// for Google events (which carry explicit offsets). Timezone-less local event strings
// are parsed in the device timezone, which is assumed to be JST.

/** JST calendar date (YYYY-MM-DD) of an ISO dateTime string. */
export function toJSTDateStr(dt: string): string {
  return new Date(new Date(dt).getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** Minutes since JST midnight of an ISO dateTime string. */
export function toJSTMinOfDay(dt: string): number {
  const d = new Date(dt);
  return (d.getUTCHours() * 60 + d.getUTCMinutes() + 9 * 60) % 1440;
}

/** Today as a local-midnight Date in JST, independent of device timezone. */
export function getJSTToday(): Date {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tokyo", year: "numeric", month: "numeric", day: "numeric",
  }).formatToParts(now);
  const y = parseInt(parts.find(p => p.type === "year")!.value);
  const m = parseInt(parts.find(p => p.type === "month")!.value) - 1;
  const d = parseInt(parts.find(p => p.type === "day")!.value);
  return new Date(y, m, d);
}

/** Local calendar date (YYYY-MM-DD) from a Date's local components.
 *  Unlike toISODate (UTC-based), this never shifts across midnight. */
export function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

export function isWeekendOrHoliday(date: Date): boolean {
  const dow = date.getDay();
  return dow === 0 || dow === 6 || isJapaneseHoliday(date);
}

/** The 7 days (Sun–Sat) of the week containing `date`. */
export function getWeekDays(date: Date): Date[] {
  const sunday = new Date(date);
  sunday.setDate(date.getDate() - date.getDay());
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(sunday);
    d.setDate(sunday.getDate() + i);
    return d;
  });
}

/** Month grid cells: leading nulls for alignment, then one Date per day. */
export function getMonthDays(year: number, month: number): (Date | null)[] {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  return cells;
}

export const DOW_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];

export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export const MON_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
