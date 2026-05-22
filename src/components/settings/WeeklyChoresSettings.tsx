"use client";

import { useState } from "react";
import { useSettingsStore } from "@/store/settingsStore";
import { useTodoStore } from "@/store/todoStore";
import { useAuthStore } from "@/store/authStore";

const DAYS = [
  { label: "Mon", value: 1 },
  { label: "Tue", value: 2 },
  { label: "Wed", value: 3 },
  { label: "Thu", value: 4 },
  { label: "Fri", value: 5 },
  { label: "Sat", value: 6 },
  { label: "Sun", value: 0 },
];

export function WeeklyChoresSettings() {
  const { routineDefinitions, addRoutine, deleteRoutine } = useSettingsStore();
  const { load: reloadTodos } = useTodoStore();
  const { householdId } = useAuthStore();

  const [addingDay, setAddingDay] = useState<number | null>(null);
  const [newLabel, setNewLabel] = useState("");

  const weeklyChores = routineDefinitions.filter(r => r.frequency === "weekly");
  const choresByDay = (day: number) => weeklyChores.filter(r => r.day_of_week === day);

  const handleAdd = async (dayOfWeek: number) => {
    if (!newLabel.trim() || !householdId) return;
    await addRoutine(householdId, {
      label: newLabel.trim(),
      frequency: "weekly",
      user_id: null,
      day_of_week: dayOfWeek,
      day_of_month: null,
      due_date: null,
    });
    await reloadTodos(householdId);
    setNewLabel("");
    setAddingDay(null);
  };

  const handleDelete = async (id: string) => {
    await deleteRoutine(id);
    if (householdId) await reloadTodos(householdId);
  };

  return (
    <div>
      <p className="text-[10px] tracking-widest text-muted-foreground uppercase mb-3">weekly chores</p>
      <div className="space-y-0">
        {DAYS.map(({ label, value }) => {
          const chores = choresByDay(value);
          return (
            <div key={value} className="flex gap-4 py-2.5 border-b border-border/40">
              <span className="text-[10px] text-muted-foreground w-6 flex-shrink-0 pt-0.5 tracking-wider">{label}</span>
              <div className="flex-1">
                {chores.map(r => (
                  <div key={r.id} className="flex items-center gap-2 mb-1">
                    <span className="flex-1 text-[12px]">{r.label}</span>
                    <button
                      onClick={() => handleDelete(r.id)}
                      className="text-muted-foreground/40 hover:text-muted-foreground transition-colors text-[14px] leading-none"
                    >
                      ×
                    </button>
                  </div>
                ))}
                {addingDay === value ? (
                  <div className="flex items-center gap-2">
                    <input
                      autoFocus
                      value={newLabel}
                      onChange={e => setNewLabel(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === "Enter") handleAdd(value);
                        if (e.key === "Escape") { setAddingDay(null); setNewLabel(""); }
                      }}
                      onBlur={() => { if (!newLabel.trim()) { setAddingDay(null); } }}
                      placeholder="chore name"
                      className="flex-1 bg-transparent text-[12px] outline-none placeholder:text-muted-foreground border-b border-border pb-0.5"
                    />
                    <button onClick={() => handleAdd(value)} className="text-[10px] text-muted-foreground flex-shrink-0">
                      add
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => { setAddingDay(value); setNewLabel(""); }}
                    className="text-[10px] text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                  >
                    + add
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
