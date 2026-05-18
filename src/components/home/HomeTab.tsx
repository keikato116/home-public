"use client";

import { useEffect, useRef, useState } from "react";
import { useTodoStore } from "@/store/todoStore";
import { useAuthStore } from "@/store/authStore";
import { getTodaysRoutines } from "@/lib/routine";
import { toISODate } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { WeatherWidget } from "./WeatherWidget";

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
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

export function HomeTab() {
  const { householdId, user } = useAuthStore();
  const {
    load, subscribeRealtime,
    routineDefinitions, completedRoutineIds,
    urgentTodos, toggleUrgentTodo, addUrgentTodo, deleteUrgentTodo,
    markRoutineDone, markRoutineUndone, addChore, deleteChore,
  } = useTodoStore();

  const today = useRef(new Date()).current;
  const [selectedDate, setSelectedDate] = useState(today);
  const [addingTask, setAddingTask] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [addingImportant, setAddingImportant] = useState(false);
  const [newImportantLabel, setNewImportantLabel] = useState("");
  const [editingRoutineId, setEditingRoutineId] = useState<string | null>(null);
  const [editingRoutineLabel, setEditingRoutineLabel] = useState("");

  useEffect(() => {
    if (!householdId) return;
    load(householdId);
    const unsub = subscribeRealtime(householdId);
    return unsub;
  }, [householdId, load, subscribeRealtime]);

  const tabs = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    return d;
  }).filter(d => isSameDay(d, today) || getTodaysRoutines(routineDefinitions, d).length > 0);

  const selectedRoutines = getTodaysRoutines(routineDefinitions, selectedDate).map(r => ({
    ...r,
    done: completedRoutineIds.has(r.id),
  }));

  const toggle = async (id: string, done: boolean) => {
    if (!householdId) return;
    if (done) await markRoutineUndone(householdId, id);
    else await markRoutineDone(householdId, id);
  };

  const handleAddTask = async () => {
    if (!newLabel.trim() || !householdId) return;
    await addChore(householdId, newLabel.trim(), false, undefined, toISODate(selectedDate));
    setNewLabel("");
    setAddingTask(false);
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
              {today.toLocaleDateString("en-US", { weekday: "long" })}
            </p>
            <div className="flex items-baseline gap-3 leading-none">
              <span className="text-[76px] font-light tracking-tight">{today.getDate()}</span>
              <span className="text-[30px] font-light text-muted-foreground tracking-wide">
                {today.toLocaleDateString("en-US", { month: "long" }).toUpperCase()}
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

        {/* Task list */}
        <div>
          <div className="flex justify-end mb-1">
            <button
              onClick={() => setAddingTask(true)}
              className="text-[11px] text-muted-foreground tracking-wider"
            >
              + add
            </button>
          </div>

          {addingTask && (
            <div className="flex items-center gap-3 py-3 border-b border-border">
              <span className="w-[18px] h-[18px] rounded border border-border flex-shrink-0" />
              <input
                autoFocus
                type="text"
                value={newLabel}
                onChange={e => setNewLabel(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter") handleAddTask();
                  if (e.key === "Escape") { setAddingTask(false); setNewLabel(""); }
                }}
                placeholder="new task"
                className="flex-1 bg-transparent text-[14px] outline-none placeholder:text-muted-foreground"
              />
              <button onClick={handleAddTask} className="text-[11px] text-muted-foreground">
                save
              </button>
            </div>
          )}

          {selectedRoutines.map(r => (
            <div key={r.id} className="flex items-center gap-3 py-3 border-b border-border">
              <button
                onClick={() => toggle(r.id, r.done)}
                className={cn(
                  "w-[18px] h-[18px] rounded border flex-shrink-0 transition-colors",
                  r.done ? "bg-foreground border-foreground" : "border-border"
                )}
                aria-label={r.done ? "undo" : "done"}
              />
              {editingRoutineId === r.id ? (
                <input
                  autoFocus
                  value={editingRoutineLabel}
                  onChange={e => setEditingRoutineLabel(e.target.value)}
                  onBlur={() => setEditingRoutineId(null)}
                  onKeyDown={e => {
                    if (e.key === "Enter" || e.key === "Escape") setEditingRoutineId(null);
                  }}
                  className="flex-1 bg-transparent text-[14px] outline-none border-b border-border"
                />
              ) : (
                <span className={cn("flex-1 text-[14px]", r.done && "line-through text-muted-foreground")}>
                  {r.label}
                </span>
              )}
              <button
                onClick={() => {
                  if (editingRoutineId === r.id) {
                    deleteChore(r.id);
                    setEditingRoutineId(null);
                  } else {
                    setEditingRoutineId(r.id);
                    setEditingRoutineLabel(r.label);
                  }
                }}
                className="text-[11px] text-muted-foreground"
              >
                {editingRoutineId === r.id ? "delete" : "edit"}
              </button>
            </div>
          ))}

          {selectedRoutines.length === 0 && !addingTask && (
            <p className="text-[11px] text-muted-foreground mt-2">no tasks</p>
          )}
        </div>
      </div>
    </div>
  );
}
