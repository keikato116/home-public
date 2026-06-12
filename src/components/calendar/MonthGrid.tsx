"use client";

import { CalendarEvent, MealPlan } from "@/types";
import { getJapaneseHolidayName } from "@/lib/japaneseHolidays";
import { toDateStr, isSameDay, isWeekendOrHoliday, getMonthDays, DOW_LETTERS } from "@/lib/dates";
import { hasEventInWindow, bothHaveAllDayEvent, hasAllDayBlock } from "@/lib/freeTime";
import { eventColor, parseTaskType } from "./lib";

interface MonthGridProps {
  selectedDate: Date;
  today: Date;
  eventsMap: Record<string, CalendarEvent[]>;
  currentUserId: string | undefined;
  plans: MealPlan[];
  onSelect: (d: Date) => void;
}

export function MonthGrid({ selectedDate, today, eventsMap, currentUserId, plans, onSelect }: MonthGridProps) {
  const year = selectedDate.getFullYear();
  const month = selectedDate.getMonth();
  const cells = getMonthDays(year, month);
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const rows = Math.ceil((firstDay + daysInMonth) / 7);
  const todayStr = toDateStr(today);

  return (
    <div className="flex flex-col flex-1 overflow-hidden px-1 pb-1">
      <div className="grid grid-cols-7 mb-0.5">
        {DOW_LETTERS.map((l, i) => (
          <div key={i} className="flex justify-center py-1">
            <span className="text-[9px] text-muted-foreground tracking-wide">{l}</span>
          </div>
        ))}
      </div>
      <div
        className="flex-1 min-h-0 grid grid-cols-7 border-l border-t border-border/20"
        style={{ gridTemplateRows: `repeat(${rows}, 1fr)` }}
      >
        {cells.map((d, i) => {
          if (!d) return <div key={i} className="border-r border-b border-border/20" />;
          const isSelected = isSameDay(d, selectedDate);
          const isToday = isSameDay(d, today);
          const holiday = getJapaneseHolidayName(d);
          const isRed = d.getDay() === 0 || !!holiday;
          const ds = toDateStr(d);
          const dayEvents = eventsMap[ds] ?? [];
          const myEvents = dayEvents.filter(e => e.ownerId === currentUserId && !e.isLocal);
          const partnerEvents = dayEvents.filter(e => e.ownerId !== currentUserId && !e.isLocal);
          const myLocalTasks = dayEvents.filter(e => e.isLocal && e.ownerId === currentUserId);
          const taskTypes = new Set(myLocalTasks.map(e => parseTaskType(e.summary)).filter(Boolean) as ("run" | "ride")[]);
          const taskBg = taskTypes.has("run") ? "rgba(251,146,60,0.06)" : taskTypes.has("ride") ? "rgba(34,211,238,0.06)" : undefined;
          const calEvents = (eventsMap[ds] ?? []).filter(e => !e.isLocal);
          const isFuture = ds >= todayStr;
          const allDayBlocked = hasAllDayBlock(d, calEvents);
          const autoFreeDinner = isFuture && !hasEventInWindow(calEvents, 18, 21) && !allDayBlocked;
          const autoFreeLunch = isFuture && !hasEventInWindow(calEvents, 11, 13) && !allDayBlocked &&
            (isWeekendOrHoliday(d) || bothHaveAllDayEvent(calEvents));
          const hasDinner = autoFreeDinner || plans.some(p => p.date === ds && (p.meal_type === "dinner" || p.meal_type === "highlight_dinner"));
          const hasLunch = autoFreeLunch || plans.some(p => p.date === ds && (p.meal_type === "lunch" || p.meal_type === "highlight_lunch"));
          return (
            <button
              key={i}
              className="flex flex-col items-start p-0.5 border-r border-b border-border/20 overflow-hidden text-left"
              style={taskBg ? { backgroundColor: taskBg } : undefined}
              onClick={() => onSelect(d)}
            >
              <span className={[
                "w-[18px] h-[18px] rounded-full flex items-center justify-center text-[10px] mb-0.5 flex-shrink-0",
                isSelected ? "bg-foreground text-background"
                  : isToday ? "border border-foreground text-foreground"
                  : isRed ? "text-red-500"
                  : "text-foreground",
              ].join(" ")}>
                {d.getDate()}
              </span>
              {holiday && (
                <span className="text-[5.5px] leading-none text-red-400 truncate w-full mb-px">{holiday}</span>
              )}
              <div className="w-full space-y-px overflow-hidden">
                {myEvents.slice(0, 3).map(e => {
                  const color = eventColor(e);
                  return (
                    <div key={e.id + "my"}
                      className="w-full text-[6.5px] leading-none truncate rounded-[2px] px-0.5 py-px text-foreground"
                      style={{ backgroundColor: color + "35", borderLeft: `2px solid ${color}` }}>
                      {e.summary}
                    </div>
                  );
                })}
                {partnerEvents.slice(0, 3).map(e => (
                  <div key={e.id + "pt"}
                    className="w-full text-[6.5px] leading-none truncate rounded-[2px] px-0.5 py-px text-muted-foreground border-l-2 border-muted-foreground/40">
                    {e.summary}
                  </div>
                ))}
              </div>
              {(hasDinner || hasLunch) && (
                <div className="flex gap-0.5 mt-auto pt-px">
                  {hasLunch && <div className="w-1.5 h-1.5 rounded-full bg-amber-400/50" />}
                  {hasDinner && <div className="w-1.5 h-1.5 rounded-full bg-purple-400/50" />}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
