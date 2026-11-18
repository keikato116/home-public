"use client";

import { useEffect, useMemo } from "react";
import { Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRecipeCategoryStore } from "@/store/recipeCategoryStore";
import { categoryTabs, subcategoryTabs, tabLabel } from "@/lib/recipeCategories";
import type { Recipe } from "@/types";

// レシピの分類のタブ（上の段と下の段）。レシピのタブと、献立でレシピを選ぶ画面で使う。
// 分類は世帯で共有していて、編集すると両方に反映される。

interface Props {
  recipes: Pick<Recipe, "category" | "subcategory">[];
  category: string | null;
  subcategory: string | null;
  onChange: (category: string, subcategory: string | null) => void;
  /** 渡すと、上の段の最後に分類の編集ボタンを出す */
  onEdit?: () => void;
}

const chip = (active: boolean) =>
  cn(
    "shrink-0 text-[10px] tracking-wider px-3 py-1.5 rounded border transition-colors",
    active ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground hover:text-foreground"
  );

export function CategoryTabs({ recipes, category, subcategory, onChange, onEdit }: Props) {
  const { tree, loaded, load } = useRecipeCategoryStore();

  useEffect(() => {
    if (!loaded) load();
  }, [loaded, load]);

  const tabs = useMemo(() => categoryTabs(tree, recipes), [tree, recipes]);
  // 選んでいた分類が消えた・名前が変わったら、先頭に戻す
  const active = category && tabs.includes(category) ? category : tabs[0] ?? null;
  useEffect(() => {
    if (active && active !== category) onChange(active, null);
  }, [active, category, onChange]);

  const subs = useMemo(() => (active ? subcategoryTabs(tree, recipes, active) : []), [tree, recipes, active]);

  return (
    <>
      <div className="flex gap-2 overflow-x-auto px-7 pb-3 scrollbar-hide">
        {tabs.map((tab) => (
          <button key={tab} onClick={() => onChange(tab, null)} className={chip(active === tab)}>
            {tabLabel(tab)}
          </button>
        ))}
        {onEdit && (
          <button
            onClick={onEdit}
            aria-label="分類を編集"
            className="shrink-0 flex items-center px-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <Settings2 size={13} />
          </button>
        )}
      </div>

      {active && subs.length > 0 && (
        <div className="flex gap-2 overflow-x-auto px-7 pb-3 scrollbar-hide">
          <button onClick={() => onChange(active, null)} className={chip(!subcategory)}>all</button>
          {subs.map((sub) => (
            <button key={sub} onClick={() => onChange(active, sub)} className={chip(subcategory === sub)}>
              {sub}
            </button>
          ))}
        </div>
      )}
    </>
  );
}
