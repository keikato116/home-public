"use client";

import { Recipe } from "@/types";

interface Props {
  recipe: Recipe;
  onClick: () => void;
}

export function RecipeCard({ recipe, onClick }: Props) {
  return (
    <button
      onClick={onClick}
      className="text-left border border-border rounded overflow-hidden hover:border-foreground/30 transition-colors"
    >
      <div className="aspect-video bg-muted flex items-center justify-center overflow-hidden">
        {recipe.thumbnail_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={recipe.thumbnail_url}
            alt={recipe.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="text-muted-foreground text-[10px] tracking-widest">
            {recipe.category ?? "recipe"}
          </span>
        )}
      </div>
      <div className="p-3 space-y-1">
        <p className="text-[11px] tracking-wide leading-relaxed line-clamp-2">{recipe.title}</p>
        <div className="flex items-center gap-2">
          {recipe.cook_time_min && (
            <span className="text-[9px] text-muted-foreground">{recipe.cook_time_min}min</span>
          )}
          {recipe.servings && (
            <span className="text-[9px] text-muted-foreground">{recipe.servings}p</span>
          )}
          {(recipe.times_made ?? 0) > 0 && (
            <span className="text-[9px] text-muted-foreground ml-auto">×{recipe.times_made}</span>
          )}
        </div>
      </div>
    </button>
  );
}
