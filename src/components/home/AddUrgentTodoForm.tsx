"use client";

import { useState } from "react";
import { useTodoStore } from "@/store/todoStore";
import { useAuthStore } from "@/store/authStore";
import { Plus } from "lucide-react";

export function AddUrgentTodoForm() {
  const [label, setLabel] = useState("");
  const [open, setOpen] = useState(false);
  const { addUrgentTodo } = useTodoStore();
  const { householdId, user } = useAuthStore();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim() || !householdId || !user) return;
    await addUrgentTodo(householdId, label.trim(), user.id);
    setLabel("");
    setOpen(false);
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 text-[11px] text-muted-foreground hover:text-foreground transition-colors py-2"
      >
        <Plus size={12} />
        <span className="tracking-wider">追加</span>
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="flex items-center gap-3 py-2">
      <input
        autoFocus
        type="text"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="タスクを入力..."
        className="flex-1 bg-transparent border-b border-border pb-1 text-[12px] focus:outline-none focus:border-foreground/40 placeholder:text-muted-foreground"
        onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
      />
      <button type="submit" disabled={!label.trim()} className="text-[11px] tracking-wider disabled:opacity-40 hover:text-muted-foreground">
        追加
      </button>
      <button type="button" onClick={() => setOpen(false)} className="text-[11px] text-muted-foreground">
        ×
      </button>
    </form>
  );
}
