"use client";

import { useState } from "react";
import { Recipe } from "@/types";
import { useRecipeStore } from "@/store/recipeStore";
import { ExternalLink, X, Loader2 } from "lucide-react";

interface Props {
  recipe: Recipe;
  onClose: () => void;
}

export function RecipeDetailModal({ recipe, onClose }: Props) {
  const { deleteRecipe, recordMade } = useRecipeStore();
  const [targetServings, setTargetServings] = useState<number>(recipe.servings ?? 2);
  const [scaledIngredients, setScaledIngredients] = useState<string | null>(null);
  const [scaling, setScaling] = useState(false);
  const [recording, setRecording] = useState(false);

  const handleDelete = async () => {
    if (!confirm("delete this recipe?")) return;
    await deleteRecipe(recipe.id);
    onClose();
  };

  const handleScale = async () => {
    if (!recipe.ingredients || !recipe.servings) return;
    if (targetServings === recipe.servings) { setScaledIngredients(null); return; }
    setScaling(true);
    try {
      const res = await fetch("/api/scale-recipe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ingredients: recipe.ingredients,
          baseServings: recipe.servings,
          targetServings,
        }),
      });
      const { scaledIngredients } = await res.json();
      setScaledIngredients(scaledIngredients);
    } catch {
      // ignore
    }
    setScaling(false);
  };

  const handleMadeIt = async () => {
    setRecording(true);
    await recordMade(recipe.id);
    setRecording(false);
  };

  const displayIngredients = scaledIngredients ?? recipe.ingredients;

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
            <div className="flex-1 space-y-1">
              <h2 className="text-[18px] tracking-wide leading-snug">{recipe.title}</h2>
              <div className="flex items-center gap-3 flex-wrap">
                {recipe.category && (
                  <span className="text-[10px] tracking-widest text-muted-foreground uppercase">{recipe.category}</span>
                )}
                {recipe.cook_time_min && (
                  <span className="text-[10px] text-muted-foreground">{recipe.cook_time_min} min</span>
                )}
              </div>
            </div>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground mt-1">
              <X size={16} />
            </button>
          </div>

          <div className="flex items-center gap-4">
            <div>
              <p className="text-[10px] tracking-widest text-muted-foreground uppercase mb-0.5">made</p>
              <p className="text-[13px]">{recipe.times_made ?? 0} times</p>
            </div>
            {recipe.last_made_at && (
              <div>
                <p className="text-[10px] tracking-widest text-muted-foreground uppercase mb-0.5">last made</p>
                <p className="text-[13px]">{recipe.last_made_at}</p>
              </div>
            )}
            <button
              onClick={handleMadeIt}
              disabled={recording}
              className="ml-auto text-[11px] border border-border rounded px-3 py-1.5 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40 flex items-center gap-1.5"
            >
              {recording ? <Loader2 size={11} className="animate-spin" /> : null}
              made it
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
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] tracking-widest text-muted-foreground uppercase">
                  ingredients
                  {recipe.servings ? ` (base: ${recipe.servings} servings)` : ""}
                  {scaledIngredients ? ` → ${targetServings} servings` : ""}
                </p>
              </div>

              {recipe.servings && (
                <div className="flex items-center gap-2 mb-3">
                  <input
                    type="number"
                    min={1}
                    value={targetServings}
                    onChange={(e) => { setTargetServings(Number(e.target.value)); setScaledIngredients(null); }}
                    className="w-14 bg-transparent border-b border-border pb-0.5 text-[12px] focus:outline-none focus:border-foreground/40 text-center"
                  />
                  <span className="text-[11px] text-muted-foreground">servings</span>
                  <button
                    type="button"
                    onClick={handleScale}
                    disabled={scaling || targetServings === recipe.servings}
                    className="text-[10px] border border-border rounded px-2.5 py-1 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40 flex items-center gap-1"
                  >
                    {scaling ? <Loader2 size={10} className="animate-spin" /> : null}
                    scale
                  </button>
                  {scaledIngredients && (
                    <button
                      type="button"
                      onClick={() => { setScaledIngredients(null); setTargetServings(recipe.servings!); }}
                      className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                    >
                      reset
                    </button>
                  )}
                </div>
              )}

              <p className="text-[12px] leading-relaxed whitespace-pre-wrap">{displayIngredients}</p>
            </div>
          )}

          {recipe.memo && (
            <div>
              <p className="text-[10px] tracking-widest text-muted-foreground uppercase mb-2">memo</p>
              <p className="text-[12px] leading-relaxed whitespace-pre-wrap text-muted-foreground">{recipe.memo}</p>
            </div>
          )}

          <button
            onClick={handleDelete}
            className="text-[11px] text-muted-foreground hover:text-red-500 transition-colors tracking-wider"
          >
            delete
          </button>
        </div>
      </div>
    </div>
  );
}
