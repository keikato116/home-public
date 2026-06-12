"use client";

import { useState } from "react";
import { CalendarEvent } from "@/types";
import { Plus, X } from "lucide-react";
import { parseTaskType } from "./lib";

const HOURS = Array.from({ length: 17 }, (_, i) => String(i + 7).padStart(2, "0"));
const MINUTES = ["00", "15", "30", "45"];

function TimeSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [h, m] = value ? value.split(":") : ["", ""];
  const setH = (newH: string) => onChange(newH ? `${newH}:${m || "00"}` : "");
  const setM = (newM: string) => onChange(h ? `${h}:${newM}` : "");
  return (
    <div className="flex items-center gap-0.5">
      <select value={h} onChange={e => setH(e.target.value)}
        className="bg-transparent text-[11px] text-muted-foreground outline-none">
        <option value="">--</option>
        {HOURS.map(v => <option key={v} value={v}>{v}</option>)}
      </select>
      <span className="text-[11px] text-muted-foreground">:</span>
      <select value={m} onChange={e => setM(e.target.value)}
        className="bg-transparent text-[11px] text-muted-foreground outline-none">
        {MINUTES.map(v => <option key={v} value={v}>{v}</option>)}
      </select>
    </div>
  );
}

interface TaskSectionProps {
  localTasks: CalendarEvent[];
  onAdd: (title: string, start?: string, end?: string) => Promise<void>;
  onDelete: (id: string) => void;
}

// Personal run/ride/task list for the selected day, with the add form
export function TaskSection({ localTasks, onAdd, onDelete }: TaskSectionProps) {
  const [showTaskInput, setShowTaskInput] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskStart, setNewTaskStart] = useState("");
  const [newTaskEnd, setNewTaskEnd] = useState("");
  const [newTaskType, setNewTaskType] = useState<"run" | "ride" | null>(null);

  function resetTaskForm() {
    setNewTaskTitle(""); setNewTaskStart(""); setNewTaskEnd(""); setNewTaskType(null); setShowTaskInput(false);
  }

  async function handleAddTask() {
    if (!newTaskTitle.trim() && !newTaskType) return;
    const storedTitle = newTaskType ? `${newTaskType}:${newTaskTitle.trim() || newTaskType}` : newTaskTitle.trim();
    const start = newTaskStart || undefined;
    const end = newTaskEnd || undefined;
    resetTaskForm();
    await onAdd(storedTitle, start, end);
  }

  return (
    <div className="mb-5">
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-[9px] tracking-[0.3em] text-muted-foreground uppercase">tasks</p>
        <button onClick={() => setShowTaskInput(v => !v)} className="text-muted-foreground">
          <Plus size={12} />
        </button>
      </div>
      {localTasks.map(task => {
        const tt = parseTaskType(task.summary);
        const name = tt ? task.summary.slice(tt.length + 1) : task.summary;
        return (
          <div key={task.id} className="flex items-center justify-between py-1 gap-2">
            {tt && (
              <span className={`text-[9px] px-1.5 py-0.5 rounded-full flex-shrink-0 ${tt === "run" ? "bg-orange-400/20 text-orange-400" : "bg-cyan-400/20 text-cyan-400"}`}>
                {tt}
              </span>
            )}
            {task.start.dateTime && (
              <span className="text-[11px] text-muted-foreground flex-shrink-0">
                {task.start.dateTime.split("T")[1]?.slice(0, 5)}
                {task.end.dateTime && ` – ${task.end.dateTime.split("T")[1]?.slice(0, 5)}`}
              </span>
            )}
            <span className="text-[12px] flex-1">{name}</span>
            <button onClick={() => onDelete(task.id)} className="text-muted-foreground/50 hover:text-muted-foreground flex-shrink-0">
              <X size={10} />
            </button>
          </div>
        );
      })}
      {localTasks.length === 0 && !showTaskInput && (
        <p className="text-[11px] text-muted-foreground/40">—</p>
      )}
      {showTaskInput && (
        <div className="mt-2 space-y-2 border border-border/40 rounded-lg px-3 py-2.5">
          {/* type selector */}
          <div className="flex gap-2">
            {(["run", "ride"] as const).map(t => (
              <button key={t} onClick={() => { const t2 = newTaskType === t ? null : t; setNewTaskType(t2); if (t2 && !newTaskTitle.trim()) setNewTaskTitle(t2); else if (!t2 && newTaskTitle === t) setNewTaskTitle(""); }}
                className={`text-[10px] px-2.5 py-1 rounded-full border transition-colors ${newTaskType === t ? (t === "run" ? "bg-orange-400/20 border-orange-400/50 text-orange-400" : "bg-cyan-400/20 border-cyan-400/50 text-cyan-400") : "border-border text-muted-foreground"}`}>
                {t}
              </button>
            ))}
          </div>
          <input
            autoFocus
            type="text"
            value={newTaskTitle}
            onChange={e => setNewTaskTitle(e.target.value)}
            onKeyDown={e => { if (e.key === "Escape") resetTaskForm(); }}
            placeholder="task name"
            className="w-full bg-transparent text-[13px] outline-none placeholder:text-muted-foreground border-b border-border/30 pb-1.5"
          />
          <div className="flex items-center gap-2">
            <TimeSelect value={newTaskStart} onChange={setNewTaskStart} />
            <span className="text-[11px] text-muted-foreground">–</span>
            <TimeSelect value={newTaskEnd} onChange={setNewTaskEnd} />
          </div>
          <div className="flex gap-3 pt-0.5">
            <button onClick={handleAddTask} disabled={!newTaskTitle.trim() && !newTaskType}
              className="text-[11px] tracking-wider border border-border rounded px-3 py-1 disabled:opacity-40">
              add
            </button>
            <button onClick={resetTaskForm} className="text-[11px] text-muted-foreground">
              cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
