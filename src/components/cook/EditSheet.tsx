"use client";

import { useState } from "react";
import { useMealPlanStore } from "@/store/mealPlanStore";
import { useRecipeStore } from "@/store/recipeStore";
import { useAuthStore } from "@/store/authStore";
import { useShoppingStore } from "@/store/shoppingStore";
import { useTodoStore } from "@/store/todoStore";
import { RecipePicker } from "@/components/recipe/RecipePicker";
import { MealPlan, Recipe } from "@/types";
import { X, Shuffle } from "lucide-react";
import { cn, toISODate } from "@/lib/utils";
import { toDateStr } from "@/lib/dates";
import { GachaResult, rollGacha } from "./gacha";

function parseIngredientLines(text: string): string[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !/^【.*】$/.test(l));
}

interface EditSheetProps {
  date: Date;
  mealType: "dinner" | "lunch";
  plan: MealPlan | undefined;
  isHighlighted: boolean;
  onToggleHighlight: () => void;
  onClose: () => void;
}

export function EditSheet({ date, mealType, plan, isHighlighted, onToggleHighlight, onClose }: EditSheetProps) {
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
