"use client";

import { useEffect, useRef, useState } from "react";
import { useTodoStore } from "@/store/todoStore";
import { useAuthStore } from "@/store/authStore";
import { useCalendarStore } from "@/store/calendarStore";
import { getTodaysRoutines } from "@/lib/routine";
import { toISODate, cn } from "@/lib/utils";
import { WeatherWidget } from "./WeatherWidget";
import { CalendarEvent } from "@/types";

const JST = "Asia/Tokyo";

function getJSTToday(): Date {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: JST, year: "numeric", month: "numeric", day: "numeric",
  }).formatToParts(now);
  const y = parseInt(parts.find(p => p.type === "year")!.value);
  const m = parseInt(parts.find(p => p.type === "month")!.value) - 1;
  const d = parseInt(parts.find(p => p.type === "day")!.value);
  return new Date(y, m, d);
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function tabLabel(date: Date, today: Date) {
  const diff = Math.round(
    (new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime() -
      new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) /
      86400000
  );
  if (diff === 0) return "TODAY";
  if (diff === 1) return "TOMORROW";
  const m = date.getMonth() + 1;
  const d = date.getDate();
  return `${m}/${d}`;
}

function ScheduleTimeline({ events, isToday, userId }: { events: CalendarEvent[]; isToday: boolean; userId?: string }) {
  const HOUR_H = 18;
  const START_H = 8;
  const END_H = 24;
  const HOURS = Array.from({ length: END_H - START_H + 1 }, (_, i) => i + START_H);
  const TIME_W = 28;

  const toMin = (dt: string) => {
    const d = new Date(dt);
    return (d.getUTCHours() * 60 + d.getUTCMinutes() + 9 * 60) % 1440;
  };
  const toTop = (min: number) => (Math.max(START_H * 60, min) - START_H * 60) / 60 * HOUR_H;

  const allDay = events.filter(e => !e.start.dateTime);
  const timed = events.filter(e => !!e.start.dateTime);
  const myEvents = timed.filter(e => e.ownerId === userId);
  const partnerEvents = timed.filter(e => e.ownerId !== userId);
  const hasPartner = partnerEvents.length > 0 || allDay.some(e => e.ownerId !== userId);

  const myName = myEvents[0]?.ownerName ?? "me";
  const partnerName = partnerEvents[0]?.ownerName ?? allDay.find(e => e.ownerId !== userId)?.ownerName ?? "";

  const nowMin = isToday
    ? (() => { const n = new Date(); return (n.getUTCHours() * 60 + n.getUTCMinutes() + 9 * 60) % 1440; })()
    : null;

  const renderCol = (evs: CalendarEvent[]) => evs.map(ev => {
    const startMin = toMin(ev.start.dateTime!);
    const endMin = ev.end.dateTime ? toMin(ev.end.dateTime) : startMin + 60;
    if (endMin <= START_H * 60) return null;
    const durMin = Math.max(15, endMin > startMin ? endMin - startMin : 60);
    const top = toTop(startMin);
    const height = Math.max(14, (durMin / 60) * HOUR_H - 1);
    return (
      <div key={ev.id} className="absolute inset-x-0.5 rounded px-1 bg-muted/70 flex items-center overflow-hidden" style={{ top, height }}>
        <p className="text-[9px] leading-none truncate w-full">{ev.summary}</p>
      </div>
    );
  });

  const totalH = (END_H - START_H) * HOUR_H;

  return (
    <div>
      <p className="text-[9px] tracking-[0.3em] text-muted-foreground uppercase mb-1.5">schedule</p>

      {/* All-day events — outside the timed grid */}
      {allDay.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {allDay.map(ev => (
            <span key={ev.id} className="text-[9px] border border-border rounded-full px-2 py-0.5 text-muted-foreground truncate max-w-full">
              {ev.summary}{ev.ownerName ? ` · ${ev.ownerName}` : ""}
            </span>
          ))}
        </div>
      )}

      {/* Timeline grid */}
      <div className="flex">
        {/* Time labels */}
        <div className="relative flex-shrink-0" style={{ width: TIME_W, height: totalH }}>
          {HOURS.map((h, i) => h % 2 === 0 && (
            <span key={h} className="absolute right-1.5 text-[9px] text-muted-foreground leading-none select-none" style={{ top: i * HOUR_H - 4 }}>
              {h === 24 ? "00" : String(h).padStart(2, "0")}
            </span>
          ))}
        </div>

        {/* My column */}
        <div className="relative flex-1 border-l border-border/30" style={{ height: totalH }}>
          <span className="absolute top-1 left-1.5 text-[9px] text-foreground font-medium leading-none z-10 select-none">
            {myName[0]?.toUpperCase()}
          </span>
          {HOURS.map((_, i) => <div key={i} className="absolute inset-x-0 border-t border-border/20" style={{ top: i * HOUR_H }} />)}
          {nowMin !== null && nowMin >= START_H * 60 && (
            <div className="absolute inset-x-0 border-t border-red-400/70 z-10" style={{ top: toTop(nowMin) }} />
          )}
          {renderCol(myEvents)}
        </div>

        {/* Partner column */}
        {hasPartner && (
          <div className="relative flex-1 border-l border-border/50" style={{ height: totalH }}>
            <span className="absolute top-1 left-1.5 text-[9px] text-muted-foreground leading-none z-10 select-none">
              {partnerName[0]?.toUpperCase()}
            </span>
            {HOURS.map((_, i) => <div key={i} className="absolute inset-x-0 border-t border-border/20" style={{ top: i * HOUR_H }} />)}
            {nowMin !== null && nowMin >= START_H * 60 && (
              <div className="absolute inset-x-0 border-t border-red-400/70 z-10" style={{ top: toTop(nowMin) }} />
            )}
            {renderCol(partnerEvents)}
          </div>
        )}
      </div>
    </div>
  );
}

export function HomeTab() {
  const { householdId, user } = useAuthStore();
  const { eventsByDate, load: loadCalendar } = useCalendarStore();
  const {
    load, subscribeRealtime,
    routineDefinitions, completedRoutineIds,
    urgentTodos, toggleUrgentTodo, addUrgentTodo, deleteUrgentTodo,
    markRoutineDone, markRoutineUndone, addChore, deleteChore,
  } = useTodoStore();

  const today = useRef(getJSTToday()).current;
  const [selectedDate, setSelectedDate] = useState(today);
  const [addingTask, setAddingTask] = useState<"personal" | "household" | null>(null);
  const [newLabel, setNewLabel] = useState("");
  const [addingImportant, setAddingImportant] = useState(false);
  const [newImportantLabel, setNewImportantLabel] = useState("");

  useEffect(() => {
    if (!householdId) return;
    load(householdId);
    const unsub = subscribeRealtime(householdId);
    return unsub;
  }, [householdId, load, subscribeRealtime]);

  useEffect(() => {
    if (!householdId) return;
    loadCalendar(householdId, null);
  }, [householdId, loadCalendar]);

  const tabs = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    return d;
  });

  const selectedRoutines = getTodaysRoutines(routineDefinitions, selectedDate).map(r => ({
    ...r,
    done: completedRoutineIds.has(r.id),
  }));
  const personalTasks = selectedRoutines.filter(r => r.user_id === user?.id);
  const householdTasks = selectedRoutines.filter(r => !r.user_id);

  const toggle = async (id: string, done: boolean) => {
    if (!householdId) return;
    if (done) await markRoutineUndone(householdId, id);
    else await markRoutineDone(householdId, id);
  };

  const handleAddTask = async (type: "personal" | "household") => {
    if (!newLabel.trim() || !householdId) return;
    const userId = type === "personal" ? (user?.id ?? null) : null;
    await addChore(householdId, newLabel.trim(), false, undefined, toISODate(selectedDate), userId);
    setNewLabel("");
    setAddingTask(null);
  };

  const handleAddImportant = async () => {
    if (!newImportantLabel.trim() || !householdId || !user) return;
    await addUrgentTodo(householdId, newImportantLabel.trim(), user.id);
    setNewImportantLabel("");
    setAddingImportant(false);
  };

  const activeUrgent = urgentTodos.filter(t => !t.done);

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="px-7 pt-10 pb-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[10px] tracking-[0.25em] text-muted-foreground uppercase mb-0.5">
              {today.toLocaleDateString("en-US", { weekday: "long", timeZone: JST })}
            </p>
            <div className="flex items-baseline gap-3 leading-none">
              <span className="text-[52px] font-light tracking-tight">{today.getDate()}</span>
              <span className="text-[22px] font-light text-muted-foreground tracking-wide">
                {today.toLocaleDateString("en-US", { month: "long", timeZone: JST }).toUpperCase()}
              </span>
            </div>
          </div>
          <WeatherWidget />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-7 pb-8 space-y-6" style={{ scrollbarWidth: "none" }}>
        {/* IMPORTANT card */}
        {(activeUrgent.length > 0 || addingImportant) && (
          <div className="bg-muted/40 rounded-2xl px-5 py-4 space-y-3">
            <p className="text-[9px] tracking-[0.3em] text-muted-foreground uppercase">Important</p>
            {activeUrgent.map(t => (
              <div key={t.id} className="flex items-center gap-3">
                <button
                  onClick={() => toggleUrgentTodo(t.id, true)}
                  className="w-[18px] h-[18px] rounded border border-border flex-shrink-0"
                  aria-label="complete"
                />
                <span
                  className="flex-1 text-[14px]"
                  onDoubleClick={() => deleteUrgentTodo(t.id)}
                >
                  {t.label}
                </span>
              </div>
            ))}
            {addingImportant && (
              <div className="flex items-center gap-3">
                <span className="w-[18px] h-[18px] rounded border border-border flex-shrink-0" />
                <input
                  autoFocus
                  value={newImportantLabel}
                  onChange={e => setNewImportantLabel(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter") handleAddImportant();
                    if (e.key === "Escape") { setAddingImportant(false); setNewImportantLabel(""); }
                  }}
                  onBlur={handleAddImportant}
                  placeholder="task name"
                  className="flex-1 bg-transparent text-[14px] outline-none placeholder:text-muted-foreground"
                />
              </div>
            )}
          </div>
        )}

        {/* + important (shown when card is empty) */}
        {activeUrgent.length === 0 && !addingImportant && (
          <button
            onClick={() => setAddingImportant(true)}
            className="text-[10px] tracking-widest text-muted-foreground"
          >
            + important
          </button>
        )}

        {/* Date tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
          {tabs.map(d => {
            const label = tabLabel(d, today);
            const routines = getTodaysRoutines(routineDefinitions, d);
            const incomplete = routines.filter(r => !completedRoutineIds.has(r.id)).length;
            const selected = isSameDay(d, selectedDate);
            return (
              <button
                key={d.toISOString().split("T")[0]}
                onClick={() => setSelectedDate(d)}
                className={cn(
                  "flex-shrink-0 flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[11px] tracking-wider transition-colors",
                  selected ? "bg-foreground text-background" : "text-muted-foreground"
                )}
              >
                {label}
                {incomplete > 0 && <span className="font-normal">{incomplete}</span>}
              </button>
            );
          })}
        </div>

        {/* Task sections */}
        {(["personal", "household"] as const).map(type => {
          const tasks = type === "personal" ? personalTasks : householdTasks;
          const label = type === "personal" ? "personal" : "chores";
          return (
            <div key={type} className="bg-muted/40 rounded-2xl px-4 py-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[9px] tracking-[0.3em] text-muted-foreground uppercase">{label}</p>
                <button
                  onClick={() => { setAddingTask(type); setNewLabel(""); }}
                  className="text-[10px] text-muted-foreground tracking-wider"
                >
                  + add
                </button>
              </div>
              {addingTask === type && (
                <div className="flex items-center gap-3 py-2">
                  <span className="w-[15px] h-[15px] rounded border border-border flex-shrink-0" />
                  <input
                    autoFocus
                    type="text"
                    value={newLabel}
                    onChange={e => setNewLabel(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === "Enter") handleAddTask(type);
                      if (e.key === "Escape") { setAddingTask(null); setNewLabel(""); }
                    }}
                    placeholder="new task"
                    className="flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground"
                  />
                  <button onClick={() => handleAddTask(type)} className="text-[10px] text-muted-foreground">save</button>
                </div>
              )}
              {tasks.map(r => (
                <div key={r.id} className="flex items-center gap-2.5 py-2">
                  <button
                    onClick={() => toggle(r.id, r.done)}
                    className={cn(
                      "w-[15px] h-[15px] rounded border flex-shrink-0 transition-colors",
                      r.done ? "bg-foreground border-foreground" : "border-border"
                    )}
                    aria-label={r.done ? "undo" : "done"}
                  />
                  <span className={cn("flex-1 text-[13px]", r.done && "line-through text-muted-foreground")}>
                    {r.label}
                  </span>
                  <button
                    onClick={() => deleteChore(r.id)}
                    className="text-muted-foreground/50 hover:text-muted-foreground transition-colors flex-shrink-0 text-[14px] leading-none"
                    aria-label="delete"
                  >
                    ×
                  </button>
                </div>
              ))}
              {tasks.length === 0 && addingTask !== type && (
                <p className="text-[11px] text-muted-foreground">-</p>
              )}
            </div>
          );
        })}

        {/* Calendar events for selected date */}
        {(() => {
          const dateKey = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo" }).format(selectedDate);
          const dayEvents = eventsByDate()[dateKey] ?? [];
          if (dayEvents.length === 0) return null;
          return (
            <ScheduleTimeline
              key={dateKey}
              events={dayEvents}
              isToday={isSameDay(selectedDate, today)}
              userId={user?.id}
            />
          );
        })()}
      </div>
    </div>
  );
}
