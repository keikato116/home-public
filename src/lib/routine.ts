import { RoutineDefinition } from "@/types";

export function getTodaysRoutines(
  definitions: RoutineDefinition[],
  today: Date
): RoutineDefinition[] {
  const dayOfWeek = today.getDay();
  const dayOfMonth = today.getDate();

  return definitions.filter((def) => {
    if (def.frequency === "daily") return true;
    if (def.frequency === "weekly") return def.day_of_week === dayOfWeek;
    if (def.frequency === "monthly") return def.day_of_month === dayOfMonth;
    return false;
  });
}
