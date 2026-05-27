"use client";

import { useState } from "react";
import { Recipe } from "@/types";
import { useRecipeStore } from "@/store/recipeStore";
import { ExternalLink, X, Loader2 } from "lucide-react";

interface Props {
  recipe: Recipe;
  onClose: () => void;
}

const VAGUE = ["適量", "少々", "お好みで", "適宜", "少量", "ひとつまみ"];

function evalNum(s: string): number {
  const mixed = s.match(/^(\d+)・(\d+)\/(\d+)$/);
  if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
  const frac = s.match(/^(\d+)\/(\d+)$/);
  if (frac) return Number(frac[1]) / Number(frac[2]);
  return Number(s);
}

function fmtNum(n: number): string {
  if (Number.isInteger(n)) return String(n);
  const fracs: [number, string][] = [
    [1 / 6, "1/6"], [1 / 4, "1/4"], [1 / 3, "1/3"], [1 / 2, "1/2"],
    [2 / 3, "2/3"], [3 / 4, "3/4"], [5 / 6, "5/6"],
  ];
  for (const [val, str] of fracs) {
    if (Math.abs(n - val) < 0.02) return str;
  }
  const whole = Math.floor(n);
  const rem = n - whole;
  if (whole > 0) {
    for (const [val, str] of fracs) {
      if (Math.abs(rem - val) < 0.02) return `${whole}・${str}`;
    }
  }
  return String(Math.round(n * 10) / 10);
}

function scaleIngredients(text: string, ratio: number): string {
  return text
    .split("\n")
    .map((line) => {
      if (VAGUE.some((w) => line.includes(w))) return line;
      return line.replace(/\d+・\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?/g, (m) =>
        fmtNum(evalNum(m) * ratio)
      );
    })
    .join("\n");
}

export function RecipeDetailModal({ recipe, onClose }: Props) {
  const { deleteRecipe, recordMade } = useRecipeStore();
  const [targetServings, setTargetServings] = useState<number>(recipe.servings ?? 2);
  const [recording, setRecording] = useState(false);

  const handleDelete = async () => {
    if (!confirm("delete this recipe?")) return;
    await deleteRecipe(recipe.id);
    onClose();
  };

  const handleMadeIt = async () => {
    setRecording(true);
    await recordMade(recipe.id);
    setRecording(false);
  };

  const ratio = recipe.servings ? targetServings / recipe.servings : 1;
  const displayIngredients =
    recipe.ingredients && recipe.servings && targetServings !== recipe.servings
      ? scaleIngredients(recipe.ingredients, ratio)
      : recipe.ingredients;

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex flex-col">
      <div className="flex-1 overflow-y-auto">
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
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] tracking-widest text-muted-foreground uppercase">
                  ingredients
                  {recipe.servings && targetServings !== recipe.servings
                    ? ` (scaled to ${targetServings})`
                    : recipe.servings
                    ? ` (${recipe.servings} servings)`
                    : ""}
                </p>
              </div>

              {recipe.servings && (
                <div className="flex items-center gap-2 mb-3">
                  <input
                    type="number"
                    min={1}
                    value={targetServings}
                    onChange={(e) => setTargetServings(Math.max(1, Number(e.target.value)))}
                    className="w-14 bg-transparent border-b border-border pb-0.5 text-[12px] focus:outline-none focus:border-foreground/40 text-center"
                  />
                  <span className="text-[11px] text-muted-foreground">servings</span>
                  {targetServings !== recipe.servings && (
                    <button
                      type="button"
                      onClick={() => setTargetServings(recipe.servings!)}
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

          {recipe.thumbnail_url && (
            <div>
              <p className="text-[10px] tracking-widest text-muted-foreground uppercase mb-2">photo</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={recipe.thumbnail_url} alt={recipe.title} className="w-full h-auto rounded" />
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
