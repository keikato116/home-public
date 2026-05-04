"use client";

import { useEffect, useState, useRef } from "react";
import { useCalendarStore } from "@/store/calendarStore";
import { useAuthStore } from "@/store/authStore";
import { CalendarEventRow } from "./CalendarEventRow";
import { RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";
import { CalendarEvent } from "@/types";

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

interface WeekStripProps {
  weekDays: Date[];
  selectedDate: Date;
  today: Date;
  eventsMap: Record<string, CalendarEvent[]>;
  currentUserId: string | undefined;
  onSelect: (d: Date) => void;
}

function WeekStrip({ weekDays, selectedDate, today, eventsMap, currentUserId, onSelect }: WeekStripProps) {
  return (
    <div className="flex border-b border-border px-4 pb-3">
      {weekDays.map((d, i) => {
        const isSelected = isSameDay(d, selectedDate);
        const isToday = isSameDay(d, today);
        const dayEvents = eventsMap[toDateStr(d)] ?? [];
        const hasOwn = dayEvents.some(e => e.ownerId === currentUserId);
        const hasPartner = dayEvents.some(e => e.ownerId && e.ownerId !== currentUserId);
        return (
          <button
            key={i}
            className="flex-1 flex flex-col items-center gap-1"
            onClick={() => onSelect(d)}
          >
            <span className="text-[9px] text-muted-foreground tracking-wide">
              {DOW_LETTERS[d.getDay()]}
            </span>
            <span
              className={[
                "w-7 h-7 rounded-full flex items-center justify-center text-[12px]",
                isSelected
                  ? "bg-foreground text-background"
                  : isToday
                  ? "border border-foreground text-foreground"
                  : "text-foreground",
              ].join(" ")}
            >
              {d.getDate()}
            </span>
            <div className="flex gap-0.5 h-1.5 items-center">
              {hasOwn && !isSelected && <span className="w-1 h-1 rounded-full bg-foreground" />}
              {hasPartner && !isSelected && <span className="w-1 h-1 rounded-full bg-muted-foreground" />}
            </div>
          </button>
        );
      })}
    </div>
  );
}

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

  return (
    <div className="px-4 pb-3 border-b border-border">
      <div className="grid grid-cols-7 mb-1">
        {DOW_LETTERS.map((l, i) => (
          <div key={i} className="flex justify-center">
            <span className="text-[9px] text-muted-foreground tracking-wide">{l}</span>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-1">
        {cells.map((d, i) => {
          if (!d) return <div key={i} />;
          const isSelected = isSameDay(d, selectedDate);
          const isToday = isSameDay(d, today);
          const dayEvents = eventsMap[toDateStr(d)] ?? [];
          const ownEvents = dayEvents.filter(e => e.ownerId === currentUserId);
          const partnerEvents = dayEvents.filter(e => e.ownerId && e.ownerId !== currentUserId);
          return (
            <button
              key={i}
              className="flex flex-col items-center gap-0.5"
              onClick={() => onSelect(d)}
            >
              <span
                className={[
                  "w-7 h-7 rounded-full flex items-center justify-center text-[11px]",
                  isSelected
                    ? "bg-foreground text-background"
                    : isToday
                    ? "border border-foreground text-foreground"
                    : "text-foreground",
                ].join(" ")}
              >
                {d.getDate()}
              </span>
              <div className="flex gap-0.5 h-1.5 items-center">
                {ownEvents.slice(0, 2).map((_, j) => (
                  <span key={`o${j}`} className="w-1 h-1 rounded-full bg-foreground" />
                ))}
                {partnerEvents.slice(0, 2).map((_, j) => (
                  <span key={`p${j}`} className="w-1 h-1 rounded-full bg-muted-foreground" />
                ))}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function CalendarTab() {
  const { householdId, accessToken, reAuthGoogle, user } = useAuthStore();
  const { load, eventsByDate, loading, error } = useCalendarStore();
  const currentUserId = user?.id;

  const today = useRef(new Date()).current;
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [selectedDate, setSelectedDate] = useState<Date>(today);

  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    if (!householdId) return;
    load(householdId, accessToken);
  }, [householdId, accessToken, load]);

  const eventsMap = eventsByDate();

  function navigate(direction: 1 | -1) {
    setSelectedDate((prev) => {
      const d = new Date(prev);
      if (viewMode === "day") {
        d.setDate(d.getDate() + direction);
      } else if (viewMode === "week") {
        d.setDate(d.getDate() + direction * 7);
      } else {
        d.setMonth(d.getMonth() + direction);
      }
      return d;
    });
  }

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return;
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) navigate(diff > 0 ? 1 : -1);
    touchStartX.current = null;
  }

  function handleSelectDay(d: Date) {
    setSelectedDate(d);
  }

  const weekDays = getWeekDays(selectedDate);
  const label = getPeriodLabel(viewMode, selectedDate);
  const dayEvents = eventsMap[toDateStr(selectedDate)] ?? [];

  return (
    <div
      className="flex flex-col h-full"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className="px-7 pt-8 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(-1)}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="previous"
          >
            <ChevronLeft size={14} />
          </button>
          <span className="text-[13px] tracking-wide">{label}</span>
          <button
            onClick={() => navigate(1)}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="next"
          >
            <ChevronRight size={14} />
          </button>
        </div>
        <button
          onClick={() => householdId && load(householdId, accessToken)}
          className="text-muted-foreground hover:text-foreground transition-colors"
          aria-label="refresh"
        >
          <RefreshCw size={13} />
        </button>
      </div>

      <div className="px-7 pb-3 flex gap-1">
        {(["day", "week", "month"] as ViewMode[]).map((mode) => (
          <button
            key={mode}
            onClick={() => setViewMode(mode)}
            className={[
              "text-[10px] tracking-widest px-2.5 py-1 rounded transition-colors",
              viewMode === mode
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground",
            ].join(" ")}
          >
            {mode}
          </button>
        ))}
      </div>

      {(viewMode === "week" || viewMode === "day") && (
        <WeekStrip
          weekDays={weekDays}
          selectedDate={selectedDate}
          today={today}
          eventsMap={eventsMap}
          currentUserId={currentUserId}
          onSelect={handleSelectDay}
        />
      )}

      {viewMode === "month" && (
        <MonthGrid
          selectedDate={selectedDate}
          today={today}
          eventsMap={eventsMap}
          currentUserId={currentUserId}
          onSelect={handleSelectDay}
        />
      )}

      <div className="flex-1 overflow-y-auto px-7 py-4 space-y-0">
        {error && (
          <div className="text-[11px] text-muted-foreground border border-border rounded p-4 space-y-3">
            <p>{error}</p>
            <button
              onClick={reAuthGoogle}
              className="border border-border rounded px-3 py-2 text-[11px] tracking-wider hover:bg-muted transition-colors"
            >
              reconnect google
            </button>
          </div>
        )}

        {loading && <p className="text-[11px] text-muted-foreground">loading...</p>}

        {!loading && !error && dayEvents.length === 0 && (
          <p className="text-[11px] text-muted-foreground">no events</p>
        )}

        {!loading && !error && dayEvents.map((event) => (
          <CalendarEventRow key={event.id + (event.ownerId ?? "")} event={event} isOwn={event.ownerId === currentUserId} />
        ))}
      </div>
    </div>
  );
}
