"use client";

import { useEffect, useState, useRef } from "react";
import { useCalendarStore } from "@/store/calendarStore";
import { useAuthStore } from "@/store/authStore";
import { useTodoStore } from "@/store/todoStore";
import { CalendarEventRow } from "./CalendarEventRow";
import { ScheduleTimeline } from "./ScheduleTimeline";
import { RefreshCw, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { CalendarEvent } from "@/types";
import { GOOGLE_COLOR_HEX } from "@/lib/calendar";

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
        const dayEvents = eventsMap[toDateStr(d)] ?? [];
        return (
          <button key={i} className="flex-1 flex flex-col items-center gap-1" onClick={() => onSelect(d)}>
            <span className="text-[9px] text-muted-foreground tracking-wide">{DOW_LETTERS[d.getDay()]}</span>
            <span className={[
              "w-7 h-7 rounded-full flex items-center justify-center text-[12px]",
              isSelected ? "bg-foreground text-background"
                : isToday ? "border border-foreground text-foreground"
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
          const dayEvents = eventsMap[toDateStr(d)] ?? [];
          const myEvents = dayEvents.filter(e => e.ownerId === currentUserId);
          const partnerEvents = dayEvents.filter(e => e.ownerId !== currentUserId);
          return (
            <button
              key={i}
              className="flex flex-col items-start p-0.5 border-r border-b border-border/20 overflow-hidden text-left"
              onClick={() => onSelect(d)}
            >
              <span className={[
                "w-[18px] h-[18px] rounded-full flex items-center justify-center text-[10px] mb-0.5 flex-shrink-0",
                isSelected ? "bg-foreground text-background"
                  : isToday ? "border border-foreground text-foreground"
                  : "text-foreground",
              ].join(" ")}>
                {d.getDate()}
              </span>
              <div className="w-full space-y-px overflow-hidden">
                {myEvents.slice(0, 3).map(e => {
                  const color = eventColor(e);
                  return (
                    <div key={e.id + "my"}
                      className="w-full text-[6.5px] leading-none truncate rounded-[2px] px-0.5 py-px"
                      style={{ backgroundColor: color + "38", color }}>
                      {e.summary}
                    </div>
                  );
                })}
                {partnerEvents.slice(0, 3).map(e => {
                  const color = eventColor(e);
                  return (
                    <div key={e.id + "pt"}
                      className="w-full text-[6.5px] leading-none truncate rounded-[2px] px-0.5 py-px border-l-2"
                      style={{ borderColor: color, color, opacity: 0.8 }}>
                      {e.summary}
                    </div>
                  );
                })}
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
        const events = eventsMap[dayStr] ?? [];
        const isToday = isSameDay(day, today);
        return (
          <div key={dayStr} className="mb-2">
            <div className="flex items-center gap-2 mb-1">
              <span className={[
                "text-[10px] tracking-widest uppercase",
                isToday ? "text-foreground" : "text-muted-foreground",
              ].join(" ")}>
                {day.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
              </span>
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

export function CalendarTab() {
  const { householdId, reAuthGoogle, user } = useAuthStore();
  const { load, eventsByDate, loading, syncing, error, addLocalEvent, deleteLocalEvent } = useCalendarStore();
  const { memberNameMap } = useTodoStore();
  const currentUserId = user?.id;

  const today = useRef(new Date()).current;
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [selectedDate, setSelectedDate] = useState<Date>(today);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newStartTime, setNewStartTime] = useState("");
  const [newEndTime, setNewEndTime] = useState("");

  const touchStartX = useRef<number | null>(null);
  const timelineScrollRef = useRef<HTMLDivElement | null>(null);

  // Initial load
  useEffect(() => {
    if (!householdId) return;
    load(householdId, null);
  }, [householdId, load]);

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

  async function handleAddLocalEvent() {
    if (!newTitle.trim() || !householdId || !currentUserId) return;
    const dateStr = toDateStr(selectedDate);
    await addLocalEvent(householdId, currentUserId, newTitle.trim(), dateStr, newStartTime || undefined, newEndTime || undefined);
    setNewTitle("");
    setNewStartTime("");
    setNewEndTime("");
    setShowAddForm(false);
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
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] tracking-widest text-muted-foreground uppercase">
                {selectedDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </span>
              <button onClick={() => setShowAddForm(v => !v)}
                className="text-muted-foreground hover:text-foreground transition-colors" aria-label="add event">
                <Plus size={14} />
              </button>
            </div>

            {showAddForm && (
              <div className="mb-4 space-y-2 border border-border rounded p-3">
                <input type="text" placeholder="event title" value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleAddLocalEvent()}
                  className="w-full bg-transparent text-[12px] tracking-wide outline-none placeholder:text-muted-foreground border-b border-border pb-1"
                  autoFocus />
                <div className="flex gap-2">
                  <input type="time" value={newStartTime} onChange={e => setNewStartTime(e.target.value)}
                    className="bg-transparent text-[11px] text-muted-foreground outline-none flex-1" />
                  <span className="text-[11px] text-muted-foreground">–</span>
                  <input type="time" value={newEndTime} onChange={e => setNewEndTime(e.target.value)}
                    className="bg-transparent text-[11px] text-muted-foreground outline-none flex-1" />
                </div>
                <div className="flex gap-2 pt-1">
                  <button onClick={handleAddLocalEvent}
                    className="text-[10px] tracking-widest border border-border rounded px-3 py-1 hover:bg-muted transition-colors">
                    add
                  </button>
                  <button onClick={() => { setShowAddForm(false); setNewTitle(""); setNewStartTime(""); setNewEndTime(""); }}
                    className="text-[10px] tracking-widest text-muted-foreground">
                    cancel
                  </button>
                </div>
              </div>
            )}

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
            {!loading && viewMode === "day" && (
              <ScheduleTimeline
                events={dayEvents}
                isToday={isSameDay(selectedDate, today)}
                userId={currentUserId}
                memberNameMap={memberNameMap}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}
