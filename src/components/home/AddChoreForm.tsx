"use client";

import { useState } from "react";
import { useTodoStore } from "@/store/todoStore";
import { useAuthStore } from "@/store/authStore";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function AddChoreForm() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [repeat, setRepeat] = useState(false);
  const [dayOfWeek, setDayOfWeek] = useState(new Date().getDay());
  const [dueDate, setDueDate] = useState(todayISO);
  const { addChore } = useTodoStore();
  const { householdId } = useAuthStore();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !householdId) return;
    await addChore(householdId, name.trim(), repeat, repeat ? dayOfWeek : undefined, repeat ? undefined : dueDate);
    setName("");
    setRepeat(false);
    setDayOfWeek(new Date().getDay());
    setDueDate(todayISO());
    setOpen(false);
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 text-[11px] text-muted-foreground hover:text-foreground transition-colors py-2"
      >
        <Plus size={12} />
        <span className="tracking-wider">add chore</span>
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3 py-2">
      <input
        autoFocus
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="chore name..."
        className="w-full bg-transparent border-b border-border pb-1 text-[12px] focus:outline-none focus:border-foreground/40 placeholder:text-muted-foreground"
        onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
      />

      <div className="flex items-center gap-3">
        <span className="text-[11px] text-muted-foreground tracking-wider">repeat</span>
        <button
          type="button"
          onClick={() => setRepeat(!repeat)}
          className={cn(
            "text-[11px] tracking-wider border border-border rounded px-2 py-0.5 transition-colors",
            repeat ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
          )}
        >
          {repeat ? "on" : "off"}
        </button>
      </div>

      {repeat ? (
        <div className="flex gap-1.5">
          {DAYS.map((d, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setDayOfWeek(i)}
              className={cn(
                "w-7 h-7 text-[11px] border border-border rounded transition-colors",
                dayOfWeek === i ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {d}
            </button>
          ))}
        </div>
      ) : (
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="bg-transparent border-b border-border pb-1 text-[12px] focus:outline-none text-foreground"
        />
      )}

      <div className="flex items-center gap-3">
        <button type="submit" disabled={!name.trim()} className="text-[11px] tracking-wider disabled:opacity-40 hover:text-muted-foreground">
          add
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-[11px] text-muted-foreground">
          ×
        </button>
      </div>
    </form>
  );
}
