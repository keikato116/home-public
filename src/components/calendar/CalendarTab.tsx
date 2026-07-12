"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import { useForegroundRefresh } from "@/hooks/useForegroundRefresh";
import { useCalendarStore } from "@/store/calendarStore";
import { useAuthStore } from "@/store/authStore";
import { useTodoStore } from "@/store/todoStore";
import { useMealPlanStore } from "@/store/mealPlanStore";
import { ScheduleTimeline } from "./ScheduleTimeline";
import { MonthGrid } from "./MonthGrid";
import { WeekStrip } from "./WeekStrip";
import { WeekAgenda } from "./WeekAgenda";
import { TaskSection } from "./TaskSection";
import { RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";
import { CalendarEvent, isHighlightPlan } from "@/types";
import { getJapaneseHolidayName } from "@/lib/japaneseHolidays";
import { hasEventInWindow, bothHaveAllDayEvent } from "@/lib/freeTime";
import { toDateStr, isSameDay, isWeekendOrHoliday, getWeekDays, getJSTToday } from "@/lib/dates";
import { ViewMode, getPeriodLabel, parseTaskType } from "./lib";

export function CalendarTab() {
  const { householdId, reAuthGoogle, user, calendarViewSignal } = useAuthStore();
  const { load, eventsByDate, loading, syncing, error, addLocalEvent, deleteLocalEvent } = useCalendarStore();
  const { memberNameMap } = useTodoStore();
  const { plans, load: loadMealPlans } = useMealPlanStore();
  const currentUserId = user?.id;

  // JST-anchored so "today" and free-evening detection don't shift on a non-JST runtime.
  const today = useRef(getJSTToday()).current;
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [selectedDate, setSelectedDate] = useState<Date>(today);

  const touchStartX = useRef<number | null>(null);
  const timelineScrollRef = useRef<HTMLDivElement | null>(null);

  // Initial load
  useEffect(() => {
    if (!householdId) return;
    load(householdId, null);
    loadMealPlans(householdId);
  }, [householdId, load, loadMealPlans, today]);

  // Tapping the calendar tab icon while already on calendar → go to month view
  useEffect(() => {
    if (calendarViewSignal > 0) setViewMode("month");
  }, [calendarViewSignal]);

  // Auto-poll every 30 seconds + refresh immediately when app comes to foreground
  const refresh = useCallback(() => {
    if (householdId) load(householdId, null);
  }, [householdId, load]);
  useForegroundRefresh(refresh, 30_000);

  const eventsMap = eventsByDate();

  function navigate(direction: 1 | -1) {
    setSelectedDate((prev) => {
      const d = new Date(prev);
      if (viewMode === "day") d.setDate(d.getDate() + direction);
      else if (viewMode === "week") d.setDate(d.getDate() + direction * 7);
      else d.setMonth(d.getMonth() + direction);
      return d;
    });
  }

  function handleTouchStart(e: React.TouchEvent) { touchStartX.current = e.touches[0].clientX; }
  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return;
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) navigate(diff > 0 ? 1 : -1);
    touchStartX.current = null;
  }

  const weekDays = getWeekDays(selectedDate);
  const label = getPeriodLabel(viewMode, selectedDate);
  const dayEvents = eventsMap[toDateStr(selectedDate)] ?? [];
  const isActive = loading || syncing;

  return (
    <div className="flex flex-col h-full" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      {/* Header */}
      <div className="px-7 pt-8 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground transition-colors" aria-label="previous">
            <ChevronLeft size={14} />
          </button>
          <span className="text-[13px] tracking-wide">{label}</span>
          <button onClick={() => navigate(1)} className="text-muted-foreground hover:text-foreground transition-colors" aria-label="next">
            <ChevronRight size={14} />
          </button>
        </div>
        <button
          onClick={() => householdId && load(householdId, null)}
          className={`text-muted-foreground hover:text-foreground transition-colors${isActive ? " animate-spin" : ""}`}
          aria-label="refresh"
        >
          <RefreshCw size={13} />
        </button>
      </div>

      {/* View mode selector */}
      <div className="px-7 pb-3 flex gap-1">
        {(["day", "week", "month"] as ViewMode[]).map((mode) => (
          <button key={mode} onClick={() => setViewMode(mode)}
            className={[
              "text-[10px] tracking-widest px-2.5 py-1 rounded transition-colors",
              viewMode === mode ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
            ].join(" ")}>
            {mode}
          </button>
        ))}
      </div>

      {/* Month: full-screen grid — clicking a day drills into day view */}
      {viewMode === "month" && (
        <>
          {(error || loading) && (
            <div className="px-7 pb-2">
              {error && !error.startsWith("TOKEN") && <p className="text-[11px] text-muted-foreground">{error}</p>}
              {error && error.startsWith("TOKEN") && (
                <button onClick={reAuthGoogle} className="text-[10px] text-muted-foreground underline underline-offset-2">connect google calendar</button>
              )}
              {loading && <p className="text-[11px] text-muted-foreground">loading...</p>}
            </div>
          )}
          <MonthGrid
            selectedDate={selectedDate}
            today={today}
            eventsMap={eventsMap}
            currentUserId={currentUserId}
            plans={plans}
            onSelect={(d) => { setSelectedDate(d); setViewMode("day"); }}
          />
        </>
      )}

      {/* Day / week: week strip + scrollable content */}
      {(viewMode === "week" || viewMode === "day") && (
        <>
          <WeekStrip weekDays={weekDays} selectedDate={selectedDate} today={today}
            eventsMap={eventsMap} onSelect={setSelectedDate} />

          <div ref={viewMode === "day" ? timelineScrollRef : undefined} className="flex-1 overflow-y-auto px-7 py-4">
            <div className="flex items-center gap-2 mb-3">
              <span className={["text-[10px] tracking-widest uppercase", getJapaneseHolidayName(selectedDate) || selectedDate.getDay() === 0 ? "text-red-500" : "text-muted-foreground"].join(" ")}>
                {selectedDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </span>
              {getJapaneseHolidayName(selectedDate) && (
                <span className="text-[9px] text-red-400">{getJapaneseHolidayName(selectedDate)}</span>
              )}
            </div>

            {error && !error.startsWith("TOKEN") && <p className="text-[11px] text-muted-foreground mb-3">{error}</p>}
            {error && error.startsWith("TOKEN") && (
              <button onClick={reAuthGoogle} className="text-[10px] text-muted-foreground underline underline-offset-2 mb-3 hover:text-foreground transition-colors">
                connect google calendar
              </button>
            )}
            {loading && <p className="text-[11px] text-muted-foreground">loading...</p>}

            {!loading && viewMode === "week" && (
              <WeekAgenda weekDays={weekDays} eventsMap={eventsMap}
                currentUserId={currentUserId} today={today} onDelete={deleteLocalEvent} />
            )}
            {!loading && viewMode === "day" && (() => {
              const localTasks = dayEvents.filter(e => e.isLocal && e.ownerId === currentUserId);
              const timedLocalTasks = localTasks.filter(e => !!e.start.dateTime);
              const ds = toDateStr(selectedDate);

              // Auto free-meal detection, kept consistent with the month view (MonthGrid):
              // an evening with no event 18–21 (and no all-day block) shows 夜ご飯; a free
              // 11–13 window on a weekend/holiday (or when both are off all day) shows 昼ごはん.
              // This is why 夜ご飯 must appear on every mutually-free evening, not only ones
              // that were manually highlighted in the cook tab.
              // Only timed plans matter: a timed event 18–21 blocks 夜ご飯, 11–13 blocks 昼ごはん.
              // All-day events (当直, birthdays, labels…) are ignored entirely. Local workout
              // logs (run:/ride: tasks) are also ignored — they don't stop you eating.
              const calEventsOnly = dayEvents.filter(e => !(e.isLocal && parseTaskType(e.summary)));
              const isFuture = ds >= toDateStr(today);
              const eveningBusy = hasEventInWindow(calEventsOnly, 18, 21);
              const middayBusy = hasEventInWindow(calEventsOnly, 11, 13);
              const autoFreeDinner = isFuture && !eveningBusy;
              const autoFreeLunch = isFuture && !middayBusy &&
                (isWeekendOrHoliday(selectedDate) || bothHaveAllDayEvent(calEventsOnly));

              // A timed event in the meal window always wins: even a manually highlighted
              // 夜ご飯 disappears once a real plan lands in 18–21, so the meal never lingers
              // on top of a newly added commitment.
              const showDinner = !eveningBusy && (autoFreeDinner || plans.some(p => p.date === ds && isHighlightPlan(p, "dinner")));
              const showLunch = !middayBusy && (autoFreeLunch || plans.some(p => p.date === ds && isHighlightPlan(p, "lunch")));

              const mealTypes: ("dinner" | "lunch")[] = [];
              if (showDinner) mealTypes.push("dinner");
              if (showLunch) mealTypes.push("lunch");

              const highlightEvents: CalendarEvent[] = mealTypes.flatMap(mealType => {
                const isDinner = mealType === "dinner";
                const [sh, eh] = isDinner ? ["18:00", "20:00"] : ["11:00", "13:00"];
                // Explicit +09:00 so the timeline places these at JST regardless of runtime tz.
                const base = {
                  summary: isDinner ? "夜ご飯" : "昼ごはん",
                  calendarColor: "#a855f7",
                  start: { dateTime: `${ds}T${sh}:00+09:00` },
                  end: { dateTime: `${ds}T${eh}:00+09:00` },
                };
                return [
                  { ...base, id: `highlight-my-${mealType}`, ownerId: currentUserId },
                  { ...base, id: `highlight-partner-${mealType}`, ownerId: "highlight-partner" },
                ];
              });
              const calEvents = [...dayEvents.filter(e => !e.isLocal), ...timedLocalTasks, ...highlightEvents];
              return (
                <>
                  <TaskSection
                    localTasks={localTasks}
                    onAdd={async (title, start, end) => {
                      if (!householdId || !currentUserId) return;
                      await addLocalEvent(householdId, currentUserId, title, ds, start, end);
                    }}
                    onDelete={deleteLocalEvent}
                  />
                  <ScheduleTimeline
                    events={calEvents}
                    isToday={isSameDay(selectedDate, today)}
                    userId={currentUserId}
                    memberNameMap={memberNameMap}
                    date={toDateStr(selectedDate)}
                  />
                </>
              );
            })()}
          </div>
        </>
      )}
    </div>
  );
}
