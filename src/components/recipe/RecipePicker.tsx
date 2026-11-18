"use client";

import { useCallback, useState } from "react";
import { useRecipeStore } from "@/store/recipeStore";
import { CategoryTabs } from "./CategoryTabs";
import { inCategory } from "@/lib/recipeCategories";
import { Recipe } from "@/types";
import { RecipeCard } from "./RecipeCard";
import { X } from "lucide-react";

interface Props {
  onSelect: (recipe: Recipe) => void;
  onClose: () => void;
}

export function RecipePicker({ onSelect, onClose }: Props) {
  const { recipes } = useRecipeStore();
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [activeSubcategory, setActiveSubcategory] = useState<string | null>(null);
  const change = useCallback((cat: string, sub: string | null) => {
    setActiveCategory(cat);
    setActiveSubcategory(sub);
  }, []);

  const filtered = recipes.filter((r) => activeCategory !== null && inCategory(r, activeCategory, activeSubcategory));

  return (
    <div className="fixed inset-0 z-[60] bg-background flex flex-col">
      <div className="flex items-center justify-between px-7 pt-10 pb-4">
        <p className="text-[10px] tracking-[0.3em] text-muted-foreground uppercase">select recipe</p>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X size={16} />
        </button>
      </div>

      <CategoryTabs recipes={recipes} category={activeCategory} subcategory={activeSubcategory} onChange={change} />

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
