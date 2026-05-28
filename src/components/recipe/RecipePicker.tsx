"use client";

import { useState } from "react";
import { useRecipeStore, RECIPE_CATEGORIES, SUBCATEGORIES } from "@/store/recipeStore";
import { Recipe } from "@/types";
import { RecipeCard } from "./RecipeCard";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

type Category = typeof RECIPE_CATEGORIES[number];

interface Props {
  onSelect: (recipe: Recipe) => void;
  onClose: () => void;
}

export function RecipePicker({ onSelect, onClose }: Props) {
  const { recipes } = useRecipeStore();
  const [activeCategory, setActiveCategory] = useState<Category>(RECIPE_CATEGORIES[0]);
  const [activeSubcategory, setActiveSubcategory] = useState<string | null>(null);

  const subcategories = SUBCATEGORIES[activeCategory];
  const filtered = recipes
    .filter((r) => r.category === activeCategory)
    .filter((r) => !activeSubcategory || r.subcategory === activeSubcategory);

  return (
    <div className="fixed inset-0 z-[60] bg-background flex flex-col">
      <div className="flex items-center justify-between px-7 pt-10 pb-4">
        <p className="text-[10px] tracking-[0.3em] text-muted-foreground uppercase">select recipe</p>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X size={16} />
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto px-7 pb-3 scrollbar-hide">
        {RECIPE_CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => { setActiveCategory(cat); setActiveSubcategory(null); }}
            className={cn(
              "shrink-0 text-[10px] tracking-wider px-3 py-1.5 rounded border transition-colors",
              activeCategory === cat
                ? "bg-foreground text-background border-foreground"
                : "border-border text-muted-foreground hover:text-foreground"
            )}
          >
            {cat}
          </button>
        ))}
      </div>

      {subcategories && (
        <div className="flex gap-2 overflow-x-auto px-7 pb-3 scrollbar-hide">
          <button
            onClick={() => setActiveSubcategory(null)}
            className={cn(
              "shrink-0 text-[10px] tracking-wider px-3 py-1.5 rounded border transition-colors",
              !activeSubcategory ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground"
            )}
          >all</button>
          {subcategories.map((sub) => (
            <button
              key={sub}
              onClick={() => setActiveSubcategory(sub)}
              className={cn(
                "shrink-0 text-[10px] tracking-wider px-3 py-1.5 rounded border transition-colors",
                activeSubcategory === sub ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground"
              )}
            >{sub}</button>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-7 pb-8">
        {filtered.length === 0 && (
          <p className="text-[11px] text-muted-foreground">no recipes yet.</p>
        )}
        <div className="grid grid-cols-2 gap-3">
          {filtered.map((r) => (
            <RecipeCard key={r.id} recipe={r} onClick={() => onSelect(r)} />
          ))}
        </div>
      </div>
    </div>
  );
}
