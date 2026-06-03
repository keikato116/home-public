"use client";

import { useEffect, useRef, useState } from "react";
import { useMealPlanStore } from "@/store/mealPlanStore";
import { useRecipeStore } from "@/store/recipeStore";
import { useAuthStore } from "@/store/authStore";
import { useCalendarStore } from "@/store/calendarStore";
import { useShoppingStore } from "@/store/shoppingStore";
import { useTodoStore } from "@/store/todoStore";
import { RecipePicker } from "@/components/recipe/RecipePicker";
import { MealPlan, CalendarEvent, Recipe } from "@/types";
import { X, ChevronLeft, ChevronRight, Shuffle } from "lucide-react";
import { isJapaneseHoliday } from "@/lib/japaneseHolidays";
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

function toJSTDateStr(dt: string): string {
  const d = new Date(dt);
  const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().slice(0, 10);
}

function hasEventInWindow(events: CalendarEvent[], startHour: number, endHour: number): boolean {
  return events.some((ev) => {
    if (!ev.start.dateTime || ev.start.date) return false;
    const startMin = toJSTMinOfDay(ev.start.dateTime);
    // If end date (JST) is later than start date, the event covers the rest of the start day
    if (ev.end.dateTime && toJSTDateStr(ev.end.dateTime) > toJSTDateStr(ev.start.dateTime)) {
      return startMin < endHour * 60;
    }
    const endMin = ev.end.dateTime ? toJSTMinOfDay(ev.end.dateTime) : startMin + 60;
    const spansMidnight = endMin < startMin;
    if (spansMidnight) return startMin < endHour * 60;
    return startMin < endHour * 60 && endMin > startHour * 60;
  });
}

function bothHaveAllDayEvent(events: CalendarEvent[]): boolean {
  const owners = new Set(
    events
      .filter(ev => ev.start.date && !ev.start.dateTime && ev.ownerId)
      .map(ev => ev.ownerId!)
  );
  return owners.size >= 2;
}

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate();
}

function isWeekendOrHoliday(date: Date): boolean {
  const dow = date.getDay();
  return dow === 0 || dow === 6 || isJapaneseHoliday(date);
}

interface DayPickerProps {
  date: Date;
  dinnerPlan: MealPlan | undefined;
  lunchPlan: MealPlan | undefined;
  isToday: boolean;
  freeEvening: boolean;
  freeLunch: boolean;
  showLunch: boolean;
  isHighlightedDinner: boolean;
  isHighlightedLunch: boolean;
  onSelectDinner: () => void;
  onSelectLunch: () => void;
}

const FREE_BG = "rgb(59 130 246 / 0.08)";

function displayLabel(label: string | null | undefined): string {
  if (!label) return "";
  const match = label.match(/^外食（(.+)）$/);
  return match ? match[1] : label;
}

function DayCell({ date, dinnerPlan, lunchPlan, isToday, freeEvening, freeLunch, showLunch, isHighlightedDinner, isHighlightedLunch, onSelectDinner, onSelectLunch }: DayPickerProps) {
  const effectiveFreeEvening = freeEvening || isHighlightedDinner;
  const effectiveFreeLunch = freeLunch || isHighlightedLunch;
  const bothFree = effectiveFreeEvening && effectiveFreeLunch;

  return (
    <div className="flex flex-col border-r border-b border-border/20 overflow-hidden min-w-0" style={bothFree ? { backgroundColor: FREE_BG } : undefined}>
      {/* Date number */}
      <div className="flex items-center px-0.5 pt-0.5">
        <span className={cn(
          "text-[9px] leading-none w-4 h-4 flex items-center justify-center rounded-full flex-shrink-0",
          isToday ? "bg-foreground text-background" : "text-muted-foreground"
        )}>
          {date.getDate()}
        </span>
      </div>
      {/* Lunch */}
      {showLunch && (
        <button onClick={onSelectLunch} className="flex-1 text-left px-0.5 min-w-0 border-b border-border/10" style={!bothFree && effectiveFreeLunch ? { backgroundColor: FREE_BG } : undefined}>
          <span className={cn("text-[7px] leading-tight truncate block", lunchPlan?.label ? "text-foreground" : "")}>
            {displayLabel(lunchPlan?.label)}
          </span>
        </button>
      )}
      {/* Dinner */}
      <button onClick={onSelectDinner} className="flex-1 text-left px-0.5 pb-0.5 min-w-0" style={!bothFree && effectiveFreeEvening ? { backgroundColor: FREE_BG } : undefined}>
        <span className={cn("text-[8px] leading-tight truncate w-full block", dinnerPlan?.label ? "text-foreground" : "")}>
          {displayLabel(dinnerPlan?.label)}
        </span>
      </button>
    </div>
  );
}

type GachaResult =
  | { type: "combo"; main: Recipe; side: Recipe }
  | { type: "single"; recipe: Recipe };

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function rollGacha(recipes: Recipe[]): GachaResult | null {
  const by = (cat: string) => recipes.filter(r => r.category === cat);
  const mains = by("main");
  const sides = by("side");
  const pastas = by("pasta");
  const noodles = by("noodles");
  const bowls = by("rice & bowl");

  const types: Array<"combo" | "pasta" | "noodles" | "bowl"> = [];
  if (mains.length > 0 && sides.length > 0) types.push("combo");
  if (pastas.length > 0) types.push("pasta");
  if (noodles.length > 0) types.push("noodles");
  if (bowls.length > 0) types.push("bowl");

  if (types.length === 0) return null;
  const type = types[Math.floor(Math.random() * types.length)];
  switch (type) {
    case "combo": return { type: "combo", main: pick(mains), side: pick(sides) };
    case "pasta": return { type: "single", recipe: pick(pastas) };
    case "noodles": return { type: "single", recipe: pick(noodles) };
    default: return { type: "single", recipe: pick(bowls) };
  }
}

interface EditSheetProps {
  date: Date;
  mealType: "dinner" | "lunch";
  plan: MealPlan | undefined;
  isHighlighted: boolean;
  onToggleHighlight: () => void;
  onClose: () => void;
}

function EditSheet({ date, mealType, plan, isHighlighted, onToggleHighlight, onClose }: EditSheetProps) {
  const { householdId } = useAuthStore();
  const { setMeal, deleteMeal } = useMealPlanStore();
  const { recipes, recordMade } = useRecipeStore();
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
  const [selectedRecipe2, setSelectedRecipe2] = useState<Recipe | null>(null);
  const [gachaResult, setGachaResult] = useState<GachaResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSlot, setPickerSlot] = useState<1 | 2>(1);

  const dateLabel = date.toLocaleDateString("ja-JP", { month: "long", day: "numeric", weekday: "short" });

  const handleGacha = () => {
    const result = rollGacha(recipes);
    if (!result) return;
    setGachaResult(result);
    setEatingOut(false);
    setLabel("");
    if (result.type === "single") {
      setSelectedRecipe(result.recipe);
    } else {
      setSelectedRecipe(null);
    }
  };

  const handleSelectRecipe = (r: Recipe) => {
    if (pickerSlot === 2) {
      setSelectedRecipe2(r);
    } else {
      setSelectedRecipe(r);
      setSelectedRecipe2(null);
    }
    setGachaResult(null);
    setEatingOut(false);
    setPickerOpen(false);
  };

  const handleEatingOutToggle = () => {
    setEatingOut(true);
    setSelectedRecipe(null);
    setSelectedRecipe2(null);
    setGachaResult(null);
    setLabel("");
  };

  const handleSave = async () => {
    if (!householdId) return;
    setSaving(true);
    try {
      const dateStr = toDateStr(date);
      let mealTitle: string | null = null;
      let ingredientLines: string[] = [];
      const recipeIdsToRecord: string[] = [];

      if (gachaResult?.type === "combo") {
        mealTitle = `${gachaResult.main.title} + ${gachaResult.side.title}`;
        if (gachaResult.main.ingredients) ingredientLines.push(...parseIngredientLines(gachaResult.main.ingredients));
        if (gachaResult.side.ingredients) ingredientLines.push(...parseIngredientLines(gachaResult.side.ingredients));
        recipeIdsToRecord.push(gachaResult.main.id, gachaResult.side.id);
        await setMeal(householdId, dateStr, mealType, null, mealTitle);
      } else if (selectedRecipe && selectedRecipe2) {
        mealTitle = `${selectedRecipe.title} + ${selectedRecipe2.title}`;
        if (selectedRecipe.ingredients) ingredientLines.push(...parseIngredientLines(selectedRecipe.ingredients));
        if (selectedRecipe2.ingredients) ingredientLines.push(...parseIngredientLines(selectedRecipe2.ingredients));
        recipeIdsToRecord.push(selectedRecipe.id, selectedRecipe2.id);
        await setMeal(householdId, dateStr, mealType, null, mealTitle);
      } else if (selectedRecipe) {
        mealTitle = selectedRecipe.title;
        if (selectedRecipe.ingredients) ingredientLines = parseIngredientLines(selectedRecipe.ingredients);
        recipeIdsToRecord.push(selectedRecipe.id);
        await setMeal(householdId, dateStr, mealType, selectedRecipe.id, mealTitle);
      } else if (eatingOut) {
        mealTitle = eatingOutDetail.trim() ? `外食（${eatingOutDetail.trim()}）` : "外食";
        await setMeal(householdId, dateStr, mealType, null, mealTitle);
      } else {
        mealTitle = label.trim() || null;
        await setMeal(householdId, dateStr, mealType, null, mealTitle);
      }

      if (recipeIdsToRecord.length > 0) {
        await Promise.allSettled(recipeIdsToRecord.map(id => recordMade(id, dateStr)));
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

  const canSave = gachaResult?.type === "combo" || selectedRecipe !== null || eatingOut || label.trim().length > 0;

  if (pickerOpen) {
    return (
      <RecipePicker
        onSelect={handleSelectRecipe}
        onClose={() => setPickerOpen(false)}
      />
    );
  }

  const openPicker = (slot: 1 | 2) => { setPickerSlot(slot); setPickerOpen(true); };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/30" onClick={onClose}>
      <div
        className="bg-background rounded-t-2xl px-6 pt-5 pb-8 space-y-4"
        style={{ paddingBottom: "calc(2rem + env(safe-area-inset-bottom))" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <p className="text-[11px] tracking-widest text-muted-foreground uppercase">{dateLabel} · {mealType}</p>
          <div className="flex items-center gap-3">
            <button
              onClick={onToggleHighlight}
              className={cn(
                "w-5 h-5 rounded-full border-2 flex-shrink-0 transition-colors",
                isHighlighted ? "bg-blue-400/70 border-blue-400/70" : "border-border"
              )}
              title={isHighlighted ? "ハイライト解除" : "ハイライト"}
            />
            <button onClick={onClose}><X size={14} className="text-muted-foreground" /></button>
          </div>
        </div>

        {/* Gacha */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleGacha}
            className="flex items-center gap-1.5 text-[11px] tracking-wider border border-border rounded-lg px-3 py-2 text-muted-foreground hover:border-foreground/40 hover:text-foreground transition-colors"
          >
            <Shuffle size={11} />
            <span>gacha</span>
          </button>
          {gachaResult && (
            <button onClick={handleGacha} className="text-[10px] text-muted-foreground hover:text-foreground transition-colors">
              reroll
            </button>
          )}
        </div>

        {/* Combo gacha result */}
        {gachaResult?.type === "combo" && (
          <div className="rounded-lg bg-muted/40 px-3 py-2.5 space-y-0.5">
            <p className="text-[13px]">{gachaResult.main.title}</p>
            <p className="text-[12px] text-muted-foreground">+ {gachaResult.side.title}</p>
            <button onClick={() => setGachaResult(null)} className="text-[10px] text-muted-foreground/50 pt-0.5 block">
              clear
            </button>
          </div>
        )}

        {/* Manual selection — hidden when combo gacha is active */}
        {gachaResult?.type !== "combo" && (
          <>
            {/* Recipe 1 */}
            <button
              onClick={() => openPicker(1)}
              className={cn(
                "w-full text-left rounded-lg px-3 py-2.5 text-[13px] border transition-colors",
                selectedRecipe ? "border-foreground/40 text-foreground" : "border-border text-muted-foreground"
              )}
            >
              {selectedRecipe ? selectedRecipe.title : "choose from recipes..."}
            </button>
            {selectedRecipe && !selectedRecipe2 && (
              <div className="flex items-center gap-3 -mt-2">
                <button onClick={() => { setSelectedRecipe(null); setSelectedRecipe2(null); }} className="text-[10px] text-muted-foreground">
                  clear
                </button>
                <button onClick={() => openPicker(2)} className="text-[10px] text-muted-foreground border border-border/50 rounded px-2 py-0.5">
                  + add side
                </button>
              </div>
            )}
            {/* Recipe 2 (combo) */}
            {selectedRecipe && selectedRecipe2 && (
              <div className="rounded-lg bg-muted/40 px-3 py-2.5 space-y-0.5 -mt-2">
                <p className="text-[13px]">{selectedRecipe.title}</p>
                <p className="text-[12px] text-muted-foreground">+ {selectedRecipe2.title}</p>
                <div className="flex gap-3 pt-0.5">
                  <button onClick={() => setSelectedRecipe2(null)} className="text-[10px] text-muted-foreground/50">
                    remove side
                  </button>
                  <button onClick={() => { setSelectedRecipe(null); setSelectedRecipe2(null); }} className="text-[10px] text-muted-foreground/50">
                    clear all
                  </button>
                </div>
              </div>
            )}

            {/* Eating out */}
            {!selectedRecipe && !selectedRecipe2 && (
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
            {!selectedRecipe && !selectedRecipe2 && !eatingOut && (
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
                placeholder="or type freely... e.g. カレー"
                className="w-full bg-muted/40 rounded-lg px-3 py-2 text-[13px] outline-none placeholder:text-muted-foreground"
              />
            )}
          </>
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
  const { plans, loading, load, toggleHighlight } = useMealPlanStore();
  const { load: loadRecipes } = useRecipeStore();
  const { eventsByDate } = useCalendarStore();
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [editDate, setEditDate] = useState<Date | null>(null);
  const [editMealType, setEditMealType] = useState<"dinner" | "lunch">("dinner");

  useEffect(() => {
    if (!householdId) return;
    load(householdId);
  }, [householdId, load]);

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

  const dinnerByDate = Object.fromEntries(
    plans.filter((p) => p.meal_type === "dinner").map((p) => [p.date, p])
  );
  const lunchByDate = Object.fromEntries(
    plans.filter((p) => p.meal_type === "lunch").map((p) => [p.date, p])
  );
  const highlightDinnerDates = new Set(plans.filter((p) => p.meal_type === "highlight_dinner").map((p) => p.date));
  const highlightLunchDates = new Set(plans.filter((p) => p.meal_type === "highlight_lunch").map((p) => p.date));

  const eventsMap = eventsByDate();
  const todayStr = toDateStr(today);

  const editPlan = editDate
    ? (editMealType === "lunch" ? lunchByDate : dinnerByDate)[toDateStr(editDate)]
    : undefined;

  const touchStartX = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(dx) > 50) goMonth(dx < 0 ? 1 : -1);
  };

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="px-5 pb-3 flex items-center justify-between" style={{ paddingTop: "max(env(safe-area-inset-top), 1rem)" }}>
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
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {cells.map((d, i) => {
          if (!d) return <div key={i} className="border-r border-b border-border/20" />;
          const ds = toDateStr(d);
          // Only Google Calendar events affect free detection.
          // Meal highlights (mealPlanStore) are synthetic and never in eventsMap.
          const dayEvents = (eventsMap[ds] ?? []).filter(e => !e.isLocal);
          const isHolidayOrWeekend = isWeekendOrHoliday(d);
          const isFuture = ds >= todayStr;
          const lunchFreeWindow = isFuture && !hasEventInWindow(dayEvents, 11, 13);
          return (
            <DayCell
              key={i}
              date={d}
              dinnerPlan={dinnerByDate[ds]}
              lunchPlan={lunchByDate[ds]}
              isToday={isSameDay(d, today)}
              freeEvening={isFuture && !hasEventInWindow(dayEvents, 18, 21)}
              freeLunch={lunchFreeWindow && (isHolidayOrWeekend || bothHaveAllDayEvent(dayEvents))}
              showLunch={true}
              isHighlightedDinner={highlightDinnerDates.has(ds)}
              isHighlightedLunch={highlightLunchDates.has(ds)}
              onSelectDinner={() => { setEditMealType("dinner"); setEditDate(d); }}
              onSelectLunch={() => { setEditMealType("lunch"); setEditDate(d); }}
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
          mealType={editMealType}
          plan={editPlan}
          isHighlighted={editMealType === "dinner"
            ? highlightDinnerDates.has(toDateStr(editDate))
            : highlightLunchDates.has(toDateStr(editDate))}
          onToggleHighlight={() => {
            if (!householdId) return;
            const ds = toDateStr(editDate);
            toggleHighlight(householdId, ds, editMealType === "dinner" ? "highlight_dinner" : "highlight_lunch");
          }}
          onClose={() => setEditDate(null)}
        />
      )}
    </div>
  );
}
