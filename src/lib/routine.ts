import { RoutineDefinition } from "@/types";
import { toISODate } from "@/lib/utils";

export function getTodaysRoutines(
  definitions: RoutineDefinition[],
  today: Date
): RoutineDefinition[] {
  const dayOfWeek = today.getDay();
  const dayOfMonth = today.getDate();
  const todayStr = toISODate(today);

  return definitions.filter((def) => {
    if (def.frequency === "daily") return true;
    if (def.frequency === "weekly") return def.day_of_week === dayOfWeek;
    if (def.frequency === "monthly") return def.day_of_month === dayOfMonth;
    if (def.frequency === "once") return def.due_date === todayStr;
    return false;
  });
}

// Returns the most recent past scheduled date for a routine (null if today is scheduled or daily).
export function getLastScheduledDate(def: RoutineDefinition, today: Date): string | null {
  const todayStr = toISODate(today);

  if (def.frequency === "once") {
    return def.due_date && def.due_date < todayStr ? def.due_date : null;
  }
  if (def.frequency === "weekly" && def.day_of_week != null) {
    const diff = (today.getDay() - def.day_of_week + 7) % 7;
    if (diff === 0) return null;
    const d = new Date(today);
    d.setDate(d.getDate() - diff);
    return toISODate(d);
  }
  if (def.frequency === "monthly" && def.day_of_month != null) {
    const dom = today.getDate();
    if (dom === def.day_of_month) return null;
    if (dom > def.day_of_month) {
      return toISODate(new Date(today.getFullYear(), today.getMonth(), def.day_of_month));
    }
    return toISODate(new Date(today.getFullYear(), today.getMonth() - 1, def.day_of_month));
  }
  return null;
}
