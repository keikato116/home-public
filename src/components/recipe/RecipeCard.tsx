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
            {recipe.source_type === "manual" ? "手入力" : recipe.source_type === "url" ? "URL" : "写真"}
          </span>
        )}
      </div>
      <div className="p-3">
        <p className="text-[11px] tracking-wide leading-relaxed line-clamp-2">{recipe.title}</p>
      </div>
    </button>
  );
}
