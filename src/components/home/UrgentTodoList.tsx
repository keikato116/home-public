"use client";

import { useTodoStore } from "@/store/todoStore";
import { cn } from "@/lib/utils";

export function UrgentTodoList() {
  const { urgentTodos, toggleUrgentTodo, deleteUrgentTodo } = useTodoStore();

  if (urgentTodos.length === 0) return null;

  return (
    <div className="space-y-0">
      <p className="text-[10px] tracking-widest text-muted-foreground uppercase mb-2">tasks</p>
      {urgentTodos.map((t) => (
        <div key={t.id} className="flex items-center gap-3 py-2.5 border-b border-border group">
          <input
            type="checkbox"
            checked={t.done}
            onChange={() => toggleUrgentTodo(t.id, !t.done)}
            className="w-3.5 h-3.5 accent-foreground cursor-pointer"
          />
          <span className={cn("text-[12px] tracking-wide flex-1", t.done && "line-through text-muted-foreground")}>
            {t.label}
          </span>
          <button
            onClick={() => deleteUrgentTodo(t.id)}
            className="text-[11px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity hover:text-foreground"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
