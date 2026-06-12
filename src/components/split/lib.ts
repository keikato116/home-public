import { SplitSession } from "@/types";
import { toDateStr, MON_SHORT } from "@/lib/dates";

export function formatDateHeader(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("ja-JP", { month: "numeric", day: "numeric", weekday: "short" });
}

export function formatDateShort(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function fmtYen(n: number) {
  return `¥${Math.round(Math.abs(n)).toLocaleString()}`;
}

// Returns the billing period for a given (viewYear, viewMonth, closingDay)
// closingDay=0 means calendar month; 1-28 means "period ends on closingDay of viewMonth"
export function getBillingPeriod(viewYear: number, viewMonth: number, closingDay: number) {
  if (closingDay === 0) {
    const days = new Date(viewYear, viewMonth + 1, 0).getDate();
    return {
      from: `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-01`,
      to:   `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(days).padStart(2, "0")}`,
      rangeLabel: null as string | null,
    };
  }
  const end   = new Date(viewYear, viewMonth, closingDay);
  const start = new Date(viewYear, viewMonth - 1, closingDay + 1);
  return {
    from: toDateStr(start),
    to:   toDateStr(end),
    rangeLabel: `${MON_SHORT[start.getMonth()]} ${start.getDate()} – ${MON_SHORT[end.getMonth()]} ${end.getDate()}`,
  };
}

// Returns the period (year, month) that contains today given a closingDay
export function getCurrentPeriod(closingDay: number) {
  const today = new Date();
  const d = today.getDate();
  const m = today.getMonth();
  const y = today.getFullYear();
  if (closingDay === 0 || d <= closingDay) return { year: y, month: m };
  const next = new Date(y, m + 1, 1);
  return { year: next.getFullYear(), month: next.getMonth() };
}

// iOS prevents zoom when font-size >= 16px
export const inputStyle = { fontSize: "16px" };

export function getSessionRatio(session: SplitSession, fallback: number): number {
  return typeof session.her_ratio === "number" ? session.her_ratio : fallback;
}
