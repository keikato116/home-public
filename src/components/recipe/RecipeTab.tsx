"use client";

import { useEffect, useState } from "react";
import { useRecipeStore, RECIPE_CATEGORIES, SUBCATEGORIES } from "@/store/recipeStore";
import { useAuthStore } from "@/store/authStore";
import { RecipeCard } from "./RecipeCard";
import { RecipeDetailModal } from "./RecipeDetailModal";
import { AddRecipeModal } from "./AddRecipeModal";
import { Recipe } from "@/types";
import { Plus, Search, X } from "lucide-react";

type Category = typeof RECIPE_CATEGORIES[number];

type SortKey = "times_made_desc" | "times_made_asc" | "cook_time_asc" | "cook_time_desc";

export function RecipeTab() {
  const { householdId, user } = useAuthStore();
  const { load, loadPreset, recipes, loading, loadError, loadingPreset } = useRecipeStore();
  const [selected, setSelected] = useState<Recipe | null>(null);
  const [adding, setAdding] = useState(false);
  const [activeCategory, setActiveCategory] = useState<Category>(RECIPE_CATEGORIES[0]);
  const [activeSubcategory, setActiveSubcategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("times_made_desc");

  useEffect(() => {
    if (!householdId) return;
    load();
  }, [householdId, load]);

  const subcategories = SUBCATEGORIES[activeCategory];

  const q = searchQuery.trim().toLowerCase();
  const filtered = (q
    ? recipes.filter((r) =>
        (r.ingredients ?? "").toLowerCase().includes(q) ||
        r.title.toLowerCase().includes(q)
      )
    : recipes
        .filter((r) => r.category === activeCategory)
        .filter((r) => !activeSubcategory || r.subcategory === activeSubcategory)
  ).slice().sort((a, b) => {
    if (sortKey === "times_made_desc") return (b.times_made ?? 0) - (a.times_made ?? 0);
    if (sortKey === "times_made_asc") return (a.times_made ?? 0) - (b.times_made ?? 0);
    if (sortKey === "cook_time_asc") return (a.cook_time_min ?? 9999) - (b.cook_time_min ?? 9999);
    return (b.cook_time_min ?? 0) - (a.cook_time_min ?? 0);
  });

  const handleCategoryChange = (cat: Category) => {
    setActiveCategory(cat);
    setActiveSubcategory(null);
  };

  return (
    <div className="flex flex-col h-full py-8">
      <div className="flex items-center justify-between mb-4 px-7">
        <div className="flex items-center gap-2">
          <button
            onClick={() => householdId && user && loadPreset(user.id)}
            disabled={loadingPreset}
            className="text-[10px] text-muted-foreground border border-border rounded px-2.5 py-1 hover:text-foreground transition-colors disabled:opacity-40"
          >
            {loadingPreset ? "loading..." : "load recipes"}
          </button>
          <button
            onClick={() => { setSearchOpen(o => !o); setSearchQuery(""); }}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <Search size={13} />
          </button>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSortKey(k => k === "times_made_desc" ? "times_made_asc" : "times_made_desc")}
            className={`text-[10px] tracking-wider transition-colors ${sortKey.startsWith("times_made") ? "text-foreground" : "text-muted-foreground"}`}
          >
            made {sortKey === "times_made_desc" ? "↓" : sortKey === "times_made_asc" ? "↑" : "↓"}
          </button>
          <button
            onClick={() => setSortKey(k => k === "cook_time_asc" ? "cook_time_desc" : "cook_time_asc")}
            className={`text-[10px] tracking-wider transition-colors ${sortKey.startsWith("cook_time") ? "text-foreground" : "text-muted-foreground"}`}
          >
            time {sortKey === "cook_time_asc" ? "↑" : sortKey === "cook_time_desc" ? "↓" : "↑"}
          </button>
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
          >
            <Plus size={12} />
            <span className="tracking-wider">add</span>
          </button>
        </div>
      </div>

      {searchOpen && (
        <div className="flex items-center gap-2 px-7 pb-3">
          <input
            autoFocus
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Escape") { setSearchOpen(false); setSearchQuery(""); } }}
            placeholder="ingredient..."
            className="flex-1 bg-muted/40 rounded-lg px-3 py-1.5 text-[12px] outline-none placeholder:text-muted-foreground"
          />
          <button onClick={() => { setSearchOpen(false); setSearchQuery(""); }} className="text-muted-foreground">
            <X size={13} />
          </button>
        </div>
      )}

      {!searchOpen && (
        <div className="flex gap-2 overflow-x-auto px-7 pb-3 scrollbar-hide">
          {RECIPE_CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => handleCategoryChange(cat)}
              className={`shrink-0 text-[10px] tracking-wider px-3 py-1.5 rounded border transition-colors ${
                activeCategory === cat
                  ? "bg-foreground text-background border-foreground"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {!searchOpen && subcategories && (
        <div className="flex gap-2 overflow-x-auto px-7 pb-3 scrollbar-hide">
          <button
            onClick={() => setActiveSubcategory(null)}
            className={`shrink-0 text-[10px] tracking-wider px-3 py-1.5 rounded border transition-colors ${
              !activeSubcategory
                ? "bg-foreground text-background border-foreground"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            all
          </button>
          {subcategories.map((sub) => (
            <button
              key={sub}
              onClick={() => setActiveSubcategory(sub)}
              className={`shrink-0 text-[10px] tracking-wider px-3 py-1.5 rounded border transition-colors ${
                activeSubcategory === sub
                  ? "bg-foreground text-background border-foreground"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {sub}
            </button>
          ))}
        </div>
      )}

      {loading && <p className="text-[11px] text-muted-foreground px-7">loading...</p>}
      {loadError && <p className="text-[11px] text-red-500 break-all px-7">{loadError}</p>}
      {!loading && !loadError && filtered.length === 0 && (
        <p className="text-[11px] text-muted-foreground px-7">no recipes yet.</p>
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
