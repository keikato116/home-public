"use client";

import { useEffect, useState } from "react";
import { useMealPlanStore } from "@/store/mealPlanStore";
import { useRecipeStore } from "@/store/recipeStore";
import { useAuthStore } from "@/store/authStore";
import { useCalendarStore } from "@/store/calendarStore";
import { MealPlan, CalendarEvent } from "@/types";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const DOW = ["S", "M", "T", "W", "T", "F", "S"];
const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function toJSTMinOfDay(dt: string): number {
  const d = new Date(dt);
  return (d.getUTCHours() * 60 + d.getUTCMinutes() + 9 * 60) % 1440;
}

function hasEveningEvent(events: CalendarEvent[]): boolean {
  return events.some((ev) => {
    if (!ev.start.dateTime) return false;
    const startMin = toJSTMinOfDay(ev.start.dateTime);
    const endMin = ev.end.dateTime ? toJSTMinOfDay(ev.end.dateTime) : startMin + 60;
    const spansMidnight = endMin <= startMin;
    return startMin >= 18 * 60 || endMin > 18 * 60 || spansMidnight;
  });
}

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate();
}

interface DayPickerProps {
  date: Date;
  plan: MealPlan | undefined;
  isToday: boolean;
  freeEvening: boolean;
  onSelect: () => void;
}

function DayCell({ date, plan, isToday, freeEvening, onSelect }: DayPickerProps) {
  const label = plan?.label ?? "";
  return (
    <button
      onClick={onSelect}
      className={cn(
        "flex flex-col items-start p-0.5 border-r border-b border-border/20 overflow-hidden min-w-0 text-left",
        freeEvening && !plan && "bg-blue-500/5"
      )}
    >
      <span className={cn(
        "text-[9px] leading-none mb-0.5 w-4 h-4 flex items-center justify-center rounded-full flex-shrink-0",
        isToday ? "bg-foreground text-background" : "text-muted-foreground"
      )}>
        {date.getDate()}
      </span>
      {freeEvening && !plan && (
        <span className="w-1 h-1 rounded-full bg-blue-400/60 mt-0.5" />
      )}
      {label && (
        <span className="text-[8px] leading-tight text-foreground truncate w-full">{label}</span>
      )}
    </button>
  );
}

interface EditSheetProps {
  date: Date;
  plan: MealPlan | undefined;
  onClose: () => void;
}

function EditSheet({ date, plan, onClose }: EditSheetProps) {
  const { householdId } = useAuthStore();
  const { setMeal, deleteMeal } = useMealPlanStore();
  const { recipes } = useRecipeStore();
  const [label, setLabel] = useState(plan?.label ?? "");
  const [recipeId, setRecipeId] = useState(plan?.recipe_id ?? "");
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<"text" | "recipe">(plan?.recipe_id ? "recipe" : "text");
  const [recipeSearch, setRecipeSearch] = useState("");

  const dateLabel = date.toLocaleDateString("ja-JP", { month: "long", day: "numeric", weekday: "short" });

  const filteredRecipes = recipes.filter((r) =>
    r.title.toLowerCase().includes(recipeSearch.toLowerCase()) ||
    (r.ingredients ?? "").toLowerCase().includes(recipeSearch.toLowerCase())
  );

  const handleSave = async () => {
    if (!householdId) return;
    setSaving(true);
    try {
      if (mode === "recipe" && recipeId) {
        const recipe = recipes.find((r) => r.id === recipeId);
        await setMeal(householdId, toDateStr(date), "dinner", recipeId, recipe?.title ?? null);
      } else {
        await setMeal(householdId, toDateStr(date), "dinner", null, label.trim() || null);
      }
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (plan) await deleteMeal(plan.id);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/30" onClick={onClose}>
      <div
        className="bg-background rounded-t-2xl px-6 pt-5 pb-8 space-y-4"
        style={{ paddingBottom: "calc(2rem + env(safe-area-inset-bottom))" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <p className="text-[11px] tracking-widest text-muted-foreground uppercase">{dateLabel} · dinner</p>
          <button onClick={onClose}><X size={14} className="text-muted-foreground" /></button>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setMode("text")}
            className={cn("text-[10px] tracking-wider px-3 py-1.5 rounded border transition-colors",
              mode === "text" ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground")}
          >free text</button>
          <button
            onClick={() => setMode("recipe")}
            className={cn("text-[10px] tracking-wider px-3 py-1.5 rounded border transition-colors",
              mode === "recipe" ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground")}
          >from recipes</button>
        </div>

        {mode === "text" && (
          <input
            autoFocus
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
            placeholder="e.g. カレー"
            className="w-full bg-muted/40 rounded-lg px-3 py-2 text-[13px] outline-none placeholder:text-muted-foreground"
          />
        )}

        {mode === "recipe" && (
          <div className="space-y-2">
            <input
              autoFocus
              type="text"
              value={recipeSearch}
              onChange={(e) => setRecipeSearch(e.target.value)}
              placeholder="search recipes..."
              className="w-full bg-muted/40 rounded-lg px-3 py-1.5 text-[12px] outline-none placeholder:text-muted-foreground"
            />
            <div className="max-h-40 overflow-y-auto space-y-0.5">
              {filteredRecipes.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setRecipeId(r.id)}
                  className={cn("w-full text-left px-3 py-2 rounded text-[12px] transition-colors",
                    recipeId === r.id ? "bg-foreground text-background" : "hover:bg-muted/40 text-foreground")}
                >
                  {r.title}
                </button>
              ))}
              {filteredRecipes.length === 0 && (
                <p className="text-[11px] text-muted-foreground px-3 py-2">no recipes found</p>
              )}
            </div>
          </div>
        )}

        <div className="flex gap-3 items-center pt-1">
          <button
            onClick={handleSave}
            disabled={saving || (mode === "text" ? !label.trim() : !recipeId)}
            className="bg-foreground text-background rounded px-5 py-2 text-[12px] tracking-wider disabled:opacity-40"
          >
            {saving ? "saving..." : "save"}
          </button>
          {plan && (
            <button onClick={handleDelete} className="text-[11px] text-muted-foreground hover:text-red-500 transition-colors">
              clear
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function CookTab() {
  const { householdId } = useAuthStore();
  const { plans, loading, load } = useMealPlanStore();
  const { load: loadRecipes, recipes } = useRecipeStore();
  const { eventsByDate } = useCalendarStore();

  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [editDate, setEditDate] = useState<Date | null>(null);

  useEffect(() => {
    if (!householdId) return;
    load(householdId, viewYear, viewMonth);
  }, [householdId, viewYear, viewMonth, load]);

  useEffect(() => {
    if (!householdId || recipes.length > 0) return;
    loadRecipes(householdId);
  }, [householdId, loadRecipes, recipes.length]);

  const goMonth = (dir: number) => {
    const d = new Date(viewYear, viewMonth + dir, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  };

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: (Date | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(viewYear, viewMonth, i + 1)),
  ];
  const rows = Math.ceil(cells.length / 7);

  const planByDate = Object.fromEntries(
    plans.filter((p) => p.meal_type === "dinner").map((p) => [p.date, p])
  );

  const eventsMap = eventsByDate();
  const todayStr = toDateStr(today);

  const editPlan = editDate ? planByDate[toDateStr(editDate)] : undefined;

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="px-5 pt-10 pb-3 flex items-center justify-between">
        <button onClick={() => goMonth(-1)} className="text-muted-foreground p-1">
          <ChevronLeft size={16} />
        </button>
        <p className="text-[12px] tracking-[0.2em] text-foreground">
          {MONTH_NAMES[viewMonth].toUpperCase()} {viewYear}
        </p>
        <button
          onClick={() => goMonth(1)}
          className="text-muted-foreground p-1"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="grid grid-cols-7 px-1">
        {DOW.map((d, i) => (
          <div key={i} className="flex justify-center py-1">
            <span className="text-[9px] text-muted-foreground">{d}</span>
          </div>
        ))}
      </div>

      <div
        className="flex-1 min-h-0 grid grid-cols-7 border-l border-t border-border/20 px-1"
        style={{ gridTemplateRows: `repeat(${rows}, 1fr)` }}
      >
        {cells.map((d, i) => {
          if (!d) return <div key={i} className="border-r border-b border-border/20" />;
          return (
            <DayCell
              key={i}
              date={d}
              plan={planByDate[toDateStr(d)]}
              isToday={isSameDay(d, today)}
              freeEvening={toDateStr(d) >= todayStr && !hasEveningEvent(eventsMap[toDateStr(d)] ?? [])}
              onSelect={() => setEditDate(d)}
            />
          );
        })}
      </div>

      {loading && (
        <p className="text-[10px] text-muted-foreground text-center py-2">loading...</p>
      )}

      {editDate && (
        <EditSheet
          date={editDate}
          plan={editPlan}
          onClose={() => setEditDate(null)}
        />
      )}
    </div>
  );
}
