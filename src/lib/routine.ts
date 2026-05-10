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
    if (def.frequency === "once") return def.due_date != null && def.due_date <= todayStr;
    return false;
  });
}
