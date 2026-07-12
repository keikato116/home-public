"use client";

import { useEffect, useRef, useState } from "react";
import { useMealPlanStore } from "@/store/mealPlanStore";
import { useRecipeStore } from "@/store/recipeStore";
import { useAuthStore } from "@/store/authStore";
import { useCalendarStore } from "@/store/calendarStore";
import { MealPlan, isHighlightPlan } from "@/types";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { toDateStr, isSameDay, isWeekendOrHoliday, DOW_LETTERS, MONTH_NAMES } from "@/lib/dates";
import { hasEventInWindow, bothHaveAllDayEvent } from "@/lib/freeTime";
import { parseTaskType } from "@/components/calendar/lib";
import { DayCell } from "./DayCell";
import { EditSheet } from "./EditSheet";

export function CookTab() {
  const { householdId } = useAuthStore();
  const { plans, loading, load, toggleHighlight } = useMealPlanStore();
  const { load: loadRecipes } = useRecipeStore();
  const { eventsByDate } = useCalendarStore();
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [editDate, setEditDate] = useState<Date | null>(null);
  const [editMealType, setEditMealType] = useState<"dinner" | "lunch">("dinner");

  useEffect(() => {
    if (!householdId) return;
    load(householdId);
  }, [householdId, load]);

  useEffect(() => {
    if (!householdId) return;
    loadRecipes(householdId);
  }, [householdId, loadRecipes]);

  const goMonth = (dir: number) => {
    const d = new Date(viewYear, viewMonth + dir, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  };

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: (Date | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(viewYear, viewMonth, i + 1)),
  ];
  const rows = Math.ceil(cells.length / 7);

  const dinnerByDate: Record<string, MealPlan> = Object.fromEntries(
    plans.filter((p) => p.meal_type === "dinner" && !isHighlightPlan(p, "dinner")).map((p) => [p.date, p])
  );
  const lunchByDate: Record<string, MealPlan> = Object.fromEntries(
    plans.filter((p) => p.meal_type === "lunch" && !isHighlightPlan(p, "lunch")).map((p) => [p.date, p])
  );
  const highlightDinnerDates = new Set(plans.filter((p) => isHighlightPlan(p, "dinner")).map((p) => p.date));
  const highlightLunchDates = new Set(plans.filter((p) => isHighlightPlan(p, "lunch")).map((p) => p.date));

  const eventsMap = eventsByDate();
  const todayStr = toDateStr(today);

  const editPlan = editDate
    ? (editMealType === "lunch" ? lunchByDate : dinnerByDate)[toDateStr(editDate)]
    : undefined;

  const touchStartX = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(dx) > 50) goMonth(dx < 0 ? 1 : -1);
  };

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="px-5 pb-3 flex items-center justify-between" style={{ paddingTop: "max(env(safe-area-inset-top), 1rem)" }}>
        <button onClick={() => goMonth(-1)} className="text-muted-foreground p-1">
          <ChevronLeft size={16} />
        </button>
        <p className="text-[12px] tracking-[0.2em] text-foreground">
          {MONTH_NAMES[viewMonth].toUpperCase()} {viewYear}
        </p>
        <button
          onClick={() => goMonth(1)}
          className="text-muted-foreground p-1"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="grid grid-cols-7 px-1">
        {DOW_LETTERS.map((d, i) => (
          <div key={i} className="flex justify-center py-1">
            <span className="text-[9px] text-muted-foreground">{d}</span>
          </div>
        ))}
      </div>

      <div
        className="flex-1 min-h-0 grid grid-cols-7 border-l border-t border-border/20 px-1"
        style={{ gridTemplateRows: `repeat(${rows}, 1fr)` }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {cells.map((d, i) => {
          if (!d) return <div key={i} className="border-r border-b border-border/20" />;
          const ds = toDateStr(d);
          // Google events and local plans (e.g. 飲み) affect free detection; only local
          // workout logs (run:/ride: tasks) are ignored. Meal highlights (mealPlanStore)
          // are synthetic and never in eventsMap.
          const dayEvents = (eventsMap[ds] ?? []).filter(e => !(e.isLocal && parseTaskType(e.summary)));
          const isHolidayOrWeekend = isWeekendOrHoliday(d);
          const isFuture = ds >= todayStr;
          const lunchFreeWindow = isFuture && !hasEventInWindow(dayEvents, 11, 13);
          return (
            <DayCell
              key={i}
              date={d}
              dinnerPlan={dinnerByDate[ds]}
              lunchPlan={lunchByDate[ds]}
              isToday={isSameDay(d, today)}
              freeEvening={isFuture && !hasEventInWindow(dayEvents, 18, 21)}
              freeLunch={lunchFreeWindow && (isHolidayOrWeekend || bothHaveAllDayEvent(dayEvents))}
              showLunch={true}
              isHighlightedDinner={highlightDinnerDates.has(ds)}
              isHighlightedLunch={highlightLunchDates.has(ds)}
              onSelectDinner={() => { setEditMealType("dinner"); setEditDate(d); }}
              onSelectLunch={() => { setEditMealType("lunch"); setEditDate(d); }}
            />
          );
        })}
      </div>

      {loading && (
        <p className="text-[10px] text-muted-foreground text-center py-2">loading...</p>
      )}

      {editDate && (
        <EditSheet
          date={editDate}
          mealType={editMealType}
          plan={editPlan}
          isHighlighted={editMealType === "dinner"
            ? highlightDinnerDates.has(toDateStr(editDate))
            : highlightLunchDates.has(toDateStr(editDate))}
          onToggleHighlight={() => {
            if (!householdId) return;
            const ds = toDateStr(editDate);
            toggleHighlight(householdId, ds, editMealType);
          }}
          onClose={() => setEditDate(null)}
        />
      )}
    </div>
  );
}
