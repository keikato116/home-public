"use client";

import { useTodoStore } from "@/store/todoStore";
import { useAuthStore } from "@/store/authStore";
import { cn } from "@/lib/utils";

export function RoutineTodoList() {
  const { todaysRoutines, markRoutineDone, markRoutineUndone } = useTodoStore();
  const { householdId } = useAuthStore();
  const routines = todaysRoutines();

  if (routines.length === 0) return null;

  const toggle = async (id: string, done: boolean) => {
    if (!householdId) return;
    if (done) await markRoutineUndone(householdId, id);
    else await markRoutineDone(householdId, id);
  };

  return (
    <div className="space-y-0">
      <p className="text-[10px] tracking-widest text-muted-foreground uppercase mb-2">routine</p>
      {routines.map((r) => (
        <label
          key={r.id}
          className="flex items-center gap-3 py-2.5 border-b border-border cursor-pointer group"
        >
          <input
            type="checkbox"
            checked={r.done}
            onChange={() => toggle(r.id, r.done)}
            className="w-3.5 h-3.5 accent-foreground cursor-pointer"
          />
          <span className={cn("text-[12px] tracking-wide flex-1", r.done && "line-through text-muted-foreground")}>
            {r.label}
          </span>
        </label>
      ))}
    </div>
  );
}
