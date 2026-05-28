"use client";

import { useEffect, useState } from "react";
import { useMealPlanStore } from "@/store/mealPlanStore";
import { useRecipeStore } from "@/store/recipeStore";
import { useAuthStore } from "@/store/authStore";
import { useCalendarStore } from "@/store/calendarStore";
import { useShoppingStore } from "@/store/shoppingStore";
import { useTodoStore } from "@/store/todoStore";
import { RecipePicker } from "@/components/recipe/RecipePicker";
import { MealPlan, CalendarEvent, Recipe } from "@/types";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { cn, toISODate } from "@/lib/utils";

function parseIngredientLines(text: string): string[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !/^【.*】$/.test(l));
}

const DOW = ["S", "M", "T", "W", "T", "F", "S"];
const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function toJSTMinOfDay(dt: string): number {
  const d = new Date(dt);
  return (d.getUTCHours() * 60 + d.getUTCMinutes() + 9 * 60) % 1440;
}

function hasEveningEvent(events: CalendarEvent[]): boolean {
  return events.some((ev) => {
    // Exclude all-day events: they have start.date only, no start.dateTime
    if (!ev.start.dateTime || ev.start.date) return false;
    const startMin = toJSTMinOfDay(ev.start.dateTime);
    const endMin = ev.end.dateTime ? toJSTMinOfDay(ev.end.dateTime) : startMin + 60;
    // Overlaps 18:00+ window: starts at/after 18:00, or ends after 18:00
    // spansMidnight: endMin wrapped around (e.g. event 23:00–01:00)
    const spansMidnight = endMin < startMin;
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
        freeEvening && "bg-blue-500/5"
      )}
    >
      <span className={cn(
        "text-[9px] leading-none mb-0.5 w-4 h-4 flex items-center justify-center rounded-full flex-shrink-0",
        isToday ? "bg-foreground text-background" : "text-muted-foreground"
      )}>
        {date.getDate()}
      </span>
      {freeEvening && (
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
  const { addItem } = useShoppingStore();
  const { addChore } = useTodoStore();

  const existingIsEatingOut = !plan?.recipe_id && plan?.label?.startsWith("外食");
  const [label, setLabel] = useState(
    existingIsEatingOut ? "" : (plan?.label ?? "")
  );
  const [eatingOut, setEatingOut] = useState(existingIsEatingOut);
  const [eatingOutDetail, setEatingOutDetail] = useState(
    existingIsEatingOut && plan?.label !== "外食"
      ? (plan?.label?.replace(/^外食（(.*)）$/, "$1") ?? "")
      : ""
  );
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(
    plan?.recipe_id ? (recipes.find((r) => r.id === plan.recipe_id) ?? null) : null
  );
  const [saving, setSaving] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const dateLabel = date.toLocaleDateString("ja-JP", { month: "long", day: "numeric", weekday: "short" });

  const handleSelectRecipe = (r: Recipe) => {
    setSelectedRecipe(r);
    setEatingOut(false);
    setPickerOpen(false);
  };

  const handleEatingOutToggle = () => {
    setEatingOut(true);
    setSelectedRecipe(null);
    setLabel("");
  };

  const handleSave = async () => {
    if (!householdId) return;
    setSaving(true);
    try {
      const dateStr = toDateStr(date);
      let mealTitle: string | null = null;
      let ingredientLines: string[] = [];

      if (selectedRecipe) {
        mealTitle = selectedRecipe.title;
        if (selectedRecipe.ingredients) {
          ingredientLines = parseIngredientLines(selectedRecipe.ingredients);
        }
        await setMeal(householdId, dateStr, "dinner", selectedRecipe.id, mealTitle);
      } else if (eatingOut) {
        mealTitle = eatingOutDetail.trim() ? `外食（${eatingOutDetail.trim()}）` : "外食";
        await setMeal(householdId, dateStr, "dinner", null, mealTitle);
      } else {
        mealTitle = label.trim() || null;
        await setMeal(householdId, dateStr, "dinner", null, mealTitle);
      }

      await Promise.allSettled(
        ingredientLines.map((line) => addItem(householdId, line, "other", dateStr))
      );

      if (mealTitle && !eatingOut) {
        await addChore(householdId, `買い出し（${mealTitle}）`, false, undefined, toISODate(date), null);
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

  const canSave = selectedRecipe !== null || eatingOut || label.trim().length > 0;

  if (pickerOpen) {
    return (
      <RecipePicker
        onSelect={handleSelectRecipe}
        onClose={() => setPickerOpen(false)}
      />
    );
  }

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

        {/* Recipe selection */}
        <button
          onClick={() => setPickerOpen(true)}
          className={cn(
            "w-full text-left rounded-lg px-3 py-2.5 text-[13px] border transition-colors",
            selectedRecipe
              ? "border-foreground/40 text-foreground"
              : "border-border text-muted-foreground"
          )}
        >
          {selectedRecipe ? selectedRecipe.title : "choose from recipes..."}
        </button>
        {selectedRecipe && (
          <button onClick={() => setSelectedRecipe(null)} className="text-[10px] text-muted-foreground -mt-2">
            clear recipe
          </button>
        )}

        {/* Eating out */}
        {!selectedRecipe && (
          <div className="space-y-2">
            <button
              onClick={handleEatingOutToggle}
              className={cn(
                "w-full text-left rounded-lg px-3 py-2.5 text-[13px] border transition-colors",
                eatingOut
                  ? "border-foreground/40 text-foreground"
                  : "border-border text-muted-foreground"
              )}
            >
              eating out
            </button>
            {eatingOut && (
              <>
                <input
                  type="text"
                  value={eatingOutDetail}
                  onChange={(e) => setEatingOutDetail(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
                  placeholder="restaurant / details... (optional)"
                  className="w-full bg-muted/40 rounded-lg px-3 py-2 text-[13px] outline-none placeholder:text-muted-foreground"
                />
                <button onClick={() => setEatingOut(false)} className="text-[10px] text-muted-foreground">
                  clear
                </button>
              </>
            )}
          </div>
        )}

        {/* Free text (only when no recipe and not eating out) */}
        {!selectedRecipe && !eatingOut && (
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
            placeholder="or type freely... e.g. カレー"
            className="w-full bg-muted/40 rounded-lg px-3 py-2 text-[13px] outline-none placeholder:text-muted-foreground"
          />
        )}

        <div className="flex gap-3 items-center pt-1">
          <button
            onClick={handleSave}
            disabled={saving || !canSave}
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
  const { load: loadRecipes } = useRecipeStore();
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
    if (!householdId) return;
    loadRecipes(householdId);
  }, [householdId, loadRecipes]);

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
