"use client";

import { useEffect, useState } from "react";
import { useRecipeStore } from "@/store/recipeStore";
import { useAuthStore } from "@/store/authStore";
import { RecipeCard } from "./RecipeCard";
import { RecipeDetailModal } from "./RecipeDetailModal";
import { AddRecipeModal } from "./AddRecipeModal";
import { Recipe } from "@/types";
import { Plus } from "lucide-react";

export function RecipeTab() {
  const { householdId, user } = useAuthStore();
  const { load, loadPreset, recipes, loading, loadingPreset } = useRecipeStore();
  const [selected, setSelected] = useState<Recipe | null>(null);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (!householdId) return;
    load(householdId);
  }, [householdId, load]);

  return (
    <div className="flex flex-col h-full px-7 py-8">
      <div className="flex items-center justify-between mb-8">
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

      {loading && <p className="text-[11px] text-muted-foreground">loading...</p>}

      {!loading && recipes.length === 0 && (
        <p className="text-[11px] text-muted-foreground">no recipes yet. add one to get started.</p>
      )}

      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-2 gap-3">
          {recipes.map((r) => (
            <RecipeCard key={r.id} recipe={r} onClick={() => setSelected(r)} />
          ))}
        </div>
      </div>

      {selected && <RecipeDetailModal recipe={selected} onClose={() => setSelected(null)} />}
      {adding && <AddRecipeModal onClose={() => setAdding(false)} />}
    </div>
  );
}
