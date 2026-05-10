"use client";

import { useState } from "react";
import { useSettingsStore } from "@/store/settingsStore";
import { useTodoStore } from "@/store/todoStore";
import { useAuthStore } from "@/store/authStore";
import { Plus } from "lucide-react";

const DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

export function RoutineSettings() {
  const { routineDefinitions, addRoutine, deleteRoutine } = useSettingsStore();
  const { load: reloadTodos } = useTodoStore();
  const { householdId } = useAuthStore();

  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [frequency, setFrequency] = useState<"daily" | "weekly" | "monthly">("daily");
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [dayOfMonth, setDayOfMonth] = useState(1);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim() || !householdId) return;
    await addRoutine(householdId, {
      label: label.trim(),
      frequency,
      day_of_week: frequency === "weekly" ? dayOfWeek : null,
      day_of_month: frequency === "monthly" ? dayOfMonth : null,
      due_date: null,
    });
    await reloadTodos(householdId);
    setLabel("");
    setOpen(false);
  };

  const handleDelete = async (id: string) => {
    await deleteRoutine(id);
    if (householdId) await reloadTodos(householdId);
  };

  const frequencyLabel = (r: typeof routineDefinitions[0]) => {
    if (r.frequency === "daily") return "daily";
    if (r.frequency === "weekly") return `every ${DAYS[r.day_of_week ?? 0]}`;
    return `monthly (${r.day_of_month})`;
  };

  return (
    <div className="space-y-4">
      <p className="text-[10px] tracking-widest text-muted-foreground uppercase">routines</p>

      <div className="space-y-0">
        {routineDefinitions.map((r) => (
          <div key={r.id} className="flex items-center gap-3 py-2.5 border-b border-border group">
            <span className="text-[12px] tracking-wide flex-1">{r.label}</span>
            <span className="text-[10px] text-muted-foreground">{frequencyLabel(r)}</span>
            <button
              onClick={() => handleDelete(r.id)}
              className="text-[11px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity hover:text-foreground"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 text-[11px] text-muted-foreground hover:text-foreground transition-colors py-1"
        >
          <Plus size={11} />
          <span className="tracking-wider">add routine</span>
        </button>
      ) : (
        <form onSubmit={submit} className="space-y-4 pt-2">
          <input
            autoFocus
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="task name..."
            className="w-full bg-transparent border-b border-border pb-1 text-[12px] focus:outline-none focus:border-foreground/40 placeholder:text-muted-foreground"
          />

          <div className="flex gap-2">
            {(["daily", "weekly", "monthly"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFrequency(f)}
                className={`text-[10px] tracking-wider px-2.5 py-1 rounded border transition-colors ${
                  frequency === f ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground"
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          {frequency === "weekly" && (
            <div className="flex gap-1">
              {DAYS.map((d, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setDayOfWeek(i)}
                  className={`w-8 h-8 text-[10px] rounded border transition-colors ${
                    dayOfWeek === i ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground"
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          )}

          {frequency === "monthly" && (
            <div>
              <input
                type="number"
                value={dayOfMonth}
                onChange={(e) => setDayOfMonth(Math.min(31, Math.max(1, Number(e.target.value))))}
                min={1}
                max={31}
                className="w-20 bg-transparent border-b border-border pb-1 text-[12px] focus:outline-none focus:border-foreground/40"
              />
              <span className="text-[12px] text-muted-foreground ml-1">th</span>
            </div>
          )}

          <div className="flex gap-3">
            <button type="submit" disabled={!label.trim()} className="text-[11px] tracking-wider disabled:opacity-40">
              add
            </button>
            <button type="button" onClick={() => setOpen(false)} className="text-[11px] text-muted-foreground">
              cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
