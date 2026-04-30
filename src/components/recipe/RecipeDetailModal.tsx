"use client";

import { Recipe } from "@/types";
import { useRecipeStore } from "@/store/recipeStore";
import { ExternalLink, X } from "lucide-react";

interface Props {
  recipe: Recipe;
  onClose: () => void;
}

export function RecipeDetailModal({ recipe, onClose }: Props) {
  const { deleteRecipe } = useRecipeStore();

  const handleDelete = async () => {
    if (!confirm("このレシピを削除しますか？")) return;
    await deleteRecipe(recipe.id, recipe.photo_path);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex flex-col">
      <div className="flex-1 overflow-y-auto">
        {recipe.thumbnail_url && (
          <div className="aspect-video bg-muted overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={recipe.thumbnail_url} alt={recipe.title} className="w-full h-full object-cover" />
          </div>
        )}
        <div className="px-7 py-6 space-y-6">
          <div className="flex items-start justify-between gap-4">
            <h2 className="text-[18px] tracking-wide leading-snug flex-1">{recipe.title}</h2>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground mt-1">
              <X size={16} />
            </button>
          </div>

          {recipe.url && (
            <a
              href={recipe.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            >
              <ExternalLink size={11} />
              <span className="truncate">{recipe.url}</span>
            </a>
          )}

          {recipe.ingredients && (
            <div>
              <p className="text-[10px] tracking-widest text-muted-foreground uppercase mb-2">材料</p>
              <p className="text-[12px] leading-relaxed whitespace-pre-wrap">{recipe.ingredients}</p>
            </div>
          )}

          {recipe.steps && (
            <div>
              <p className="text-[10px] tracking-widest text-muted-foreground uppercase mb-2">手順</p>
              <p className="text-[12px] leading-relaxed whitespace-pre-wrap">{recipe.steps}</p>
            </div>
          )}

          <button
            onClick={handleDelete}
            className="text-[11px] text-muted-foreground hover:text-red-500 transition-colors tracking-wider"
          >
            削除
          </button>
        </div>
      </div>
    </div>
  );
}
