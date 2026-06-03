"use client";

import { useEffect, useState, useRef } from "react";
import { useCalendarStore } from "@/store/calendarStore";
import { useAuthStore } from "@/store/authStore";
import { useTodoStore } from "@/store/todoStore";
import { useMealPlanStore } from "@/store/mealPlanStore";
import { CalendarEventRow } from "./CalendarEventRow";
import { ScheduleTimeline } from "./ScheduleTimeline";
import { RefreshCw, ChevronLeft, ChevronRight, Plus, X } from "lucide-react";
import { CalendarEvent } from "@/types";
import { GOOGLE_COLOR_HEX } from "@/lib/calendar";
import { getJapaneseHolidayName } from "@/lib/japaneseHolidays";

type ViewMode = "day" | "week" | "month";

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getWeekDays(date: Date): Date[] {
  const sunday = new Date(date);
  sunday.setDate(date.getDate() - date.getDay());
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(sunday);
    d.setDate(sunday.getDate() + i);
    return d;
  });
}

function getMonthDays(year: number, month: number): (Date | null)[] {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  return cells;
}

function eventColor(event: CalendarEvent): string {
  return event.colorId ? GOOGLE_COLOR_HEX[event.colorId] : "#888888";
}

const DOW_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function getPeriodLabel(viewMode: ViewMode, selectedDate: Date): string {
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

// Week strip — shows colored event bars per day (no text, columns too narrow)
interface WeekStripProps {
  weekDays: Date[];
  selectedDate: Date;
  today: Date;
  eventsMap: Record<string, CalendarEvent[]>;
  onSelect: (d: Date) => void;
}

function WeekStrip({ weekDays, selectedDate, today, eventsMap, onSelect }: WeekStripProps) {
  return (
    <div className="flex border-b border-border px-4 pb-3">
      {weekDays.map((d, i) => {
        const isSelected = isSameDay(d, selectedDate);
        const isToday = isSameDay(d, today);
        const holiday = getJapaneseHolidayName(d);
        const isRed = d.getDay() === 0 || !!holiday;
        const dayEvents = eventsMap[toDateStr(d)] ?? [];
        return (
          <button key={i} className="flex-1 flex flex-col items-center gap-1" onClick={() => onSelect(d)}>
            <span className="text-[9px] text-muted-foreground tracking-wide">{DOW_LETTERS[d.getDay()]}</span>
            <span className={[
              "w-7 h-7 rounded-full flex items-center justify-center text-[12px]",
              isSelected ? "bg-foreground text-background"
                : isToday ? "border border-foreground text-foreground"
                : isRed ? "text-red-500"
                : "text-foreground",
            ].join(" ")}>
              {d.getDate()}
            </span>
            <div className="flex flex-col gap-px w-full px-0.5 mt-0.5">
              {dayEvents.slice(0, 3).map((e) => (
                <div key={e.id + (e.ownerId ?? "")} className="w-full h-1 rounded-sm"
                  style={{ backgroundColor: eventColor(e) }} />
              ))}
              {dayEvents.length > 3 && <div className="w-full h-1 rounded-sm bg-muted-foreground opacity-40" />}
            </div>
          </button>
        );
      })}
    </div>
  );
}

// Month grid — full-screen, self events (solid) vs partner events (outlined)
interface MonthGridProps {
  selectedDate: Date;
  today: Date;
  eventsMap: Record<string, CalendarEvent[]>;
  currentUserId: string | undefined;
  onSelect: (d: Date) => void;
}

function parseTaskType(summary: string): "run" | "ride" | null {
  if (summary.startsWith("run:")) return "run";
  if (summary.startsWith("ride:")) return "ride";
  return null;
}

function MonthGrid({ selectedDate, today, eventsMap, currentUserId, onSelect }: MonthGridProps) {
  const year = selectedDate.getFullYear();
  const month = selectedDate.getMonth();
  const cells = getMonthDays(year, month);
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const rows = Math.ceil((firstDay + daysInMonth) / 7);

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
          const dayEvents = eventsMap[toDateStr(d)] ?? [];
          const myEvents = dayEvents.filter(e => e.ownerId === currentUserId && !e.isLocal);
          const partnerEvents = dayEvents.filter(e => e.ownerId !== currentUserId && !e.isLocal);
          const myLocalTasks = dayEvents.filter(e => e.isLocal && e.ownerId === currentUserId);
          const taskType = myLocalTasks.map(e => parseTaskType(e.summary)).find(t => t !== null);
          const taskBg = taskType === "run" ? "rgba(251,146,60,0.12)" : taskType === "ride" ? "rgba(34,211,238,0.12)" : undefined;
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
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Week agenda — shows all 7 days with their events inline
interface WeekAgendaProps {
  weekDays: Date[];
  eventsMap: Record<string, CalendarEvent[]>;
  currentUserId: string | undefined;
  today: Date;
  onDelete: (id: string) => void;
}

function WeekAgenda({ weekDays, eventsMap, currentUserId, today, onDelete }: WeekAgendaProps) {
  return (
    <>
      {weekDays.map((day) => {
        const dayStr = toDateStr(day);
        const events = (eventsMap[dayStr] ?? []).filter(e => !e.isLocal);
        const isToday = isSameDay(day, today);
        return (
          <div key={dayStr} className="mb-2">
            <div className="flex items-center gap-2 mb-1">
              <span className={[
                "text-[10px] tracking-widest uppercase",
                isToday ? "text-foreground" : day.getDay() === 0 || getJapaneseHolidayName(day) ? "text-red-500" : "text-muted-foreground",
              ].join(" ")}>
                {day.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
              </span>
              {getJapaneseHolidayName(day) && (
                <span className="text-[9px] text-red-400">{getJapaneseHolidayName(day)}</span>
              )}
              {isToday && <span className="w-1 h-1 rounded-full bg-foreground" />}
            </div>
            {events.length === 0
              ? <p className="text-[10px] text-muted-foreground pl-0">—</p>
              : events.map(e => (
                <CalendarEventRow
                  key={e.id + (e.ownerId ?? "")}
                  event={e}
                  isOwn={e.ownerId === currentUserId}
                  onDelete={e.isLocal ? onDelete : undefined}
                />
              ))
            }
          </div>
        );
      })}
    </>
  );
}

const HOURS = Array.from({ length: 17 }, (_, i) => String(i + 7).padStart(2, "0"));
const MINUTES = ["00", "15", "30", "45"];

function TimeSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [h, m] = value ? value.split(":") : ["", ""];
  const setH = (newH: string) => onChange(newH ? `${newH}:${m || "00"}` : "");
  const setM = (newM: string) => onChange(h ? `${h}:${newM}` : "");
  return (
    <div className="flex items-center gap-0.5">
      <select value={h} onChange={e => setH(e.target.value)}
        className="bg-transparent text-[11px] text-muted-foreground outline-none">
        <option value="">--</option>
        {HOURS.map(v => <option key={v} value={v}>{v}</option>)}
      </select>
      <span className="text-[11px] text-muted-foreground">:</span>
      <select value={m} onChange={e => setM(e.target.value)}
        className="bg-transparent text-[11px] text-muted-foreground outline-none">
        {MINUTES.map(v => <option key={v} value={v}>{v}</option>)}
      </select>
    </div>
  );
}

export function CalendarTab() {
  const { householdId, reAuthGoogle, user } = useAuthStore();
  const { load, eventsByDate, loading, syncing, error, addLocalEvent, deleteLocalEvent } = useCalendarStore();
  const { memberNameMap } = useTodoStore();
  const { plans, load: loadMealPlans } = useMealPlanStore();
  const currentUserId = user?.id;

  const today = useRef(new Date()).current;
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [selectedDate, setSelectedDate] = useState<Date>(today);
  const [showTaskInput, setShowTaskInput] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskStart, setNewTaskStart] = useState("");
  const [newTaskEnd, setNewTaskEnd] = useState("");
  const [newTaskType, setNewTaskType] = useState<"run" | "ride" | null>(null);

  const touchStartX = useRef<number | null>(null);
  const timelineScrollRef = useRef<HTMLDivElement | null>(null);

  // Initial load
  useEffect(() => {
    if (!householdId) return;
    load(householdId, null);
    loadMealPlans(householdId, today.getFullYear(), today.getMonth() + 1);
  }, [householdId, load, loadMealPlans, today]);

  // Auto-poll every 30 seconds + refresh immediately when app comes to foreground
  useEffect(() => {
    if (!householdId) return;
    const refresh = () => {
      if (document.visibilityState === "visible") load(householdId, null);
    };
    const id = setInterval(refresh, 30_000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [householdId, load]);

  function resetTaskForm() {
    setNewTaskTitle(""); setNewTaskStart(""); setNewTaskEnd(""); setNewTaskType(null); setShowTaskInput(false);
  }

  async function handleAddTask() {
    if (!newTaskTitle.trim() && !newTaskType) return;
    if (!householdId || !currentUserId) return;
    const storedTitle = newTaskType ? `${newTaskType}:${newTaskTitle.trim() || newTaskType}` : newTaskTitle.trim();
    await addLocalEvent(householdId, currentUserId, storedTitle, toDateStr(selectedDate), newTaskStart || undefined, newTaskEnd || undefined);
    resetTaskForm();
  }

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
              const localTasks = dayEvents.filter(e => e.isLocal);
              const timedLocalTasks = localTasks.filter(e => !!e.start.dateTime);
              const ds = toDateStr(selectedDate);
              const highlightEvents: CalendarEvent[] = plans
                .filter(p => p.date === ds && (p.meal_type === "highlight_dinner" || p.meal_type === "highlight_lunch"))
                .map(p => {
                  const [sh, eh] = p.meal_type === "highlight_dinner" ? ["18:00", "20:00"] : ["11:00", "13:00"];
                  return {
                    id: `highlight-${p.id}`,
                    summary: p.meal_type === "highlight_dinner" ? "夜ご飯" : "昼ごはん",
                    calendarColor: "#a855f7",
                    start: { dateTime: `${ds}T${sh}:00` },
                    end: { dateTime: `${ds}T${eh}:00` },
                    ownerId: currentUserId,
                  };
                });
              const calEvents = [...dayEvents.filter(e => !e.isLocal), ...timedLocalTasks, ...highlightEvents];
              return (
                <>
                  {/* Tasks */}
                  <div className="mb-5">
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-[9px] tracking-[0.3em] text-muted-foreground uppercase">tasks</p>
                      <button onClick={() => setShowTaskInput(v => !v)} className="text-muted-foreground">
                        <Plus size={12} />
                      </button>
                    </div>
                    {localTasks.map(task => {
                      const tt = parseTaskType(task.summary);
                      const name = tt ? task.summary.slice(tt.length + 1) : task.summary;
                      return (
                        <div key={task.id} className="flex items-center justify-between py-1 gap-2">
                          {tt && (
                            <span className={`text-[9px] px-1.5 py-0.5 rounded-full flex-shrink-0 ${tt === "run" ? "bg-orange-400/20 text-orange-400" : "bg-cyan-400/20 text-cyan-400"}`}>
                              {tt}
                            </span>
                          )}
                          {task.start.dateTime && (
                            <span className="text-[11px] text-muted-foreground flex-shrink-0">
                              {task.start.dateTime.split("T")[1]?.slice(0, 5)}
                              {task.end.dateTime && ` – ${task.end.dateTime.split("T")[1]?.slice(0, 5)}`}
                            </span>
                          )}
                          <span className="text-[12px] flex-1">{name}</span>
                          <button onClick={() => deleteLocalEvent(task.id)} className="text-muted-foreground/50 hover:text-muted-foreground flex-shrink-0">
                            <X size={10} />
                          </button>
                        </div>
                      );
                    })}
                    {localTasks.length === 0 && !showTaskInput && (
                      <p className="text-[11px] text-muted-foreground/40">—</p>
                    )}
                    {showTaskInput && (
                      <div className="mt-2 space-y-2 border border-border/40 rounded-lg px-3 py-2.5">
                        {/* type selector */}
                        <div className="flex gap-2">
                          {(["run", "ride"] as const).map(t => (
                            <button key={t} onClick={() => { const t2 = newTaskType === t ? null : t; setNewTaskType(t2); if (t2 && !newTaskTitle.trim()) setNewTaskTitle(t2); else if (!t2 && newTaskTitle === t) setNewTaskTitle(""); }}
                              className={`text-[10px] px-2.5 py-1 rounded-full border transition-colors ${newTaskType === t ? (t === "run" ? "bg-orange-400/20 border-orange-400/50 text-orange-400" : "bg-cyan-400/20 border-cyan-400/50 text-cyan-400") : "border-border text-muted-foreground"}`}>
                              {t}
                            </button>
                          ))}
                        </div>
                        <input
                          autoFocus
                          type="text"
                          value={newTaskTitle}
                          onChange={e => setNewTaskTitle(e.target.value)}
                          onKeyDown={e => { if (e.key === "Escape") resetTaskForm(); }}
                          placeholder="task name"
                          className="w-full bg-transparent text-[13px] outline-none placeholder:text-muted-foreground border-b border-border/30 pb-1.5"
                        />
                        <div className="flex items-center gap-2">
                          <TimeSelect value={newTaskStart} onChange={setNewTaskStart} />
                          <span className="text-[11px] text-muted-foreground">–</span>
                          <TimeSelect value={newTaskEnd} onChange={setNewTaskEnd} />
                        </div>
                        <div className="flex gap-3 pt-0.5">
                          <button onClick={handleAddTask} disabled={!newTaskTitle.trim() && !newTaskType}
                            className="text-[11px] tracking-wider border border-border rounded px-3 py-1 disabled:opacity-40">
                            add
                          </button>
                          <button onClick={resetTaskForm} className="text-[11px] text-muted-foreground">
                            cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                  <ScheduleTimeline
                    events={calEvents}
                    isToday={isSameDay(selectedDate, today)}
                    userId={currentUserId}
                    memberNameMap={memberNameMap}
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
