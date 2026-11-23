"use client";

import { useState } from "react";
import { useSettingsStore } from "@/store/settingsStore";
import { useTodoStore } from "@/store/todoStore";
import { useAuthStore } from "@/store/authStore";
import { compareByNotifyAt, formatNotifyAt, syncChoreNotifications } from "@/lib/notifications";

const DAYS = [
  { label: "Mon", value: 1 },
  { label: "Tue", value: 2 },
  { label: "Wed", value: 3 },
  { label: "Thu", value: 4 },
  { label: "Fri", value: 5 },
  { label: "Sat", value: 6 },
  { label: "Sun", value: 0 },
];

const PRESET: { day: number; label: string }[] = [
  { day: 1, label: "Garbage" }, { day: 1, label: "Laundry" },
  { day: 2, label: "Laundry" },
  { day: 3, label: "Floor cleaning" }, { day: 3, label: "Toilet cleaning" }, { day: 3, label: "Laundry" },
  { day: 4, label: "Garbage" }, { day: 4, label: "Laundry" },
  { day: 5, label: "Laundry" },
  { day: 6, label: "Laundry" },
  { day: 0, label: "Floor cleaning" }, { day: 0, label: "Toilet cleaning" },
];

// 家事ごとの時刻は notify_at（世帯で共有）。下の NOTIFICATION の時刻と同じ値で、
// どちらで変えても同じになる。時刻を入れた家事は、通知をオンにしている端末で鳴る。

/** "07:00" → "07:00:00"。空なら null（＝時刻なし） */
const toNotifyAt = (value: string) => (value ? `${value}:00` : null);

export function WeeklyChoresSettings() {
  const { routineDefinitions, addRoutine, deleteRoutine, setRoutineNotifyAt } = useSettingsStore();
  const todoRoutines = useTodoStore((s) => s.routineDefinitions);
  const { load: reloadTodos } = useTodoStore();
  const { householdId } = useAuthStore();

  const [addingDay, setAddingDay] = useState<number | null>(null);
  const [newLabel, setNewLabel] = useState("");
  const [newTime, setNewTime] = useState("");
  const [loadingPreset, setLoadingPreset] = useState(false);

  const weeklyChores = routineDefinitions.filter(r => r.frequency === "weekly");
  const choresByDay = (day: number) => weeklyChores.filter(r => r.day_of_week === day).sort(compareByNotifyAt);

  const handleAdd = async (dayOfWeek: number) => {
    if (!newLabel.trim() || !householdId) return;
    await addRoutine(householdId, {
      label: newLabel.trim(),
      frequency: "weekly",
      user_id: null,
      day_of_week: dayOfWeek,
      day_of_month: null,
      due_date: null,
      notify_at: toNotifyAt(newTime),
    });
    await reloadTodos(householdId);
    setNewLabel("");
    setNewTime("");
    setAddingDay(null);
  };

  const changeTime = async (id: string, value: string) => {
    const notifyAt = toNotifyAt(value);
    await setRoutineNotifyAt(id, notifyAt);
    // 通知の予約も組み直す（NOTIFICATION で変えたときと同じ）
    await syncChoreNotifications(
      todoRoutines.map((r) => (r.id === id ? { ...r, notify_at: notifyAt } : r))
    );
  };

  const handleDelete = async (id: string) => {
    await deleteRoutine(id);
    if (householdId) await reloadTodos(householdId);
  };

  const handleLoadPreset = async () => {
    if (!householdId) return;
    setLoadingPreset(true);
    for (const { day, label } of PRESET) {
      const already = weeklyChores.some(r => r.day_of_week === day && r.label === label);
      if (!already) {
        await addRoutine(householdId, {
          label,
          frequency: "weekly",
          user_id: null,
          day_of_week: day,
          day_of_month: null,
          due_date: null,
          notify_at: null,
        });
      }
    }
    await reloadTodos(householdId);
    setLoadingPreset(false);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] tracking-widest text-muted-foreground uppercase">weekly chores</p>
        <button
          onClick={handleLoadPreset}
          disabled={loadingPreset}
          className="text-[10px] text-muted-foreground border border-border rounded px-2.5 py-1 hover:text-foreground transition-colors disabled:opacity-40"
        >
          {loadingPreset ? "adding..." : "load preset"}
        </button>
      </div>
      <div className="space-y-0">
        {DAYS.map(({ label, value }) => {
          const chores = choresByDay(value);
          return (
            <div key={value} className="flex gap-4 py-2.5 border-b border-border/40">
              <span className="text-[10px] text-muted-foreground w-6 flex-shrink-0 pt-0.5 tracking-wider">{label}</span>
              <div className="flex-1">
                {chores.map(r => (
                  <div key={r.id} className="flex items-center gap-2 mb-1">
                    <span className="flex-1 text-[12px] truncate">{r.label}</span>
                    <input
                      type="time"
                      value={formatNotifyAt(r.notify_at)}
                      onChange={e => changeTime(r.id, e.target.value)}
                      aria-label={`${r.label}の時刻`}
                      className="bg-background border border-border rounded px-2 py-0.5 text-[11px] w-[100px] flex-shrink-0"
                    />
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
                        if (e.key === "Escape") { setAddingDay(null); setNewLabel(""); setNewTime(""); }
                      }}
                      placeholder="chore name"
                      className="flex-1 min-w-0 bg-transparent text-[12px] outline-none placeholder:text-muted-foreground border-b border-border pb-0.5"
                    />
                    <input
                      type="time"
                      value={newTime}
                      onChange={e => setNewTime(e.target.value)}
                      aria-label="時刻"
                      className="bg-background border border-border rounded px-2 py-0.5 text-[11px] w-[100px] flex-shrink-0"
                    />
                    <button onClick={() => handleAdd(value)} className="text-[10px] text-muted-foreground flex-shrink-0">
                      add
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => { setAddingDay(value); setNewLabel(""); setNewTime(""); }}
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
