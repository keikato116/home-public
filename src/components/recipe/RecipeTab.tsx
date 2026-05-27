"use client";

import { useEffect, useState } from "react";
import { useRecipeStore, RECIPE_CATEGORIES } from "@/store/recipeStore";
import { useAuthStore } from "@/store/authStore";
import { RecipeCard } from "./RecipeCard";
import { RecipeDetailModal } from "./RecipeDetailModal";
import { AddRecipeModal } from "./AddRecipeModal";
import { Recipe } from "@/types";
import { Plus } from "lucide-react";

type Category = typeof RECIPE_CATEGORIES[number] | "all";

export function RecipeTab() {
  const { householdId, user } = useAuthStore();
  const { load, loadPreset, recipes, loading, loadError, loadingPreset } = useRecipeStore();
  const [selected, setSelected] = useState<Recipe | null>(null);
  const [adding, setAdding] = useState(false);
  const [activeCategory, setActiveCategory] = useState<Category>("all");

  useEffect(() => {
    if (!householdId) return;
    load(householdId);
  }, [householdId, load]);

  const tabs: Category[] = ["all", ...RECIPE_CATEGORIES];
  const filtered = activeCategory === "all"
    ? recipes
    : recipes.filter((r) => r.category === activeCategory);

  return (
    <div className="flex flex-col h-full py-8">
      <div className="flex items-center justify-between mb-4 px-7">
        <button
          onClick={() => householdId && user && loadPreset(householdId, user.id)}
          disabled={loadingPreset}
          className="text-[10px] text-muted-foreground border border-border rounded px-2.5 py-1 hover:text-foreground transition-colors disabled:opacity-40"
        >
          {loadingPreset ? "loading..." : "load recipes"}
        </button>
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
        >
          <Plus size={12} />
          <span className="tracking-wider">add</span>
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto px-7 pb-4 scrollbar-hide">
        {tabs.map((tab) => {
          const count = tab === "all" ? recipes.length : recipes.filter((r) => r.category === tab).length;
          if (tab !== "all" && count === 0) return null;
          return (
            <button
              key={tab}
              onClick={() => setActiveCategory(tab)}
              className={`shrink-0 text-[10px] tracking-wider px-3 py-1.5 rounded border transition-colors ${
                activeCategory === tab
                  ? "bg-foreground text-background border-foreground"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab}{tab !== "all" && count > 0 ? ` ${count}` : count > 0 ? ` ${count}` : ""}
            </button>
          );
        })}
      </div>

      {loading && <p className="text-[11px] text-muted-foreground px-7">loading...</p>}
      {loadError && <p className="text-[11px] text-red-500 break-all px-7">{loadError}</p>}
      {!loading && !loadError && filtered.length === 0 && (
        <p className="text-[11px] text-muted-foreground px-7">
          {activeCategory === "all" ? "no recipes yet. add one to get started." : "no recipes in this category."}
        </p>
      )}

      <div className="flex-1 overflow-y-auto px-7">
        <div className="grid grid-cols-2 gap-3">
          {filtered.map((r) => (
            <RecipeCard key={r.id} recipe={r} onClick={() => setSelected(r)} />
          ))}
        </div>
      </div>

      {selected && <RecipeDetailModal recipe={selected} onClose={() => setSelected(null)} />}
      {adding && <AddRecipeModal onClose={() => setAdding(false)} />}
    </div>
  );
}
