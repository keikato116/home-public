"use client";

import { useState } from "react";
import { Recipe } from "@/types";
import { useRecipeStore, RECIPE_CATEGORIES, SUBCATEGORIES } from "@/store/recipeStore";
import { ExternalLink, X, Loader2, Pencil, Check } from "lucide-react";

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
  const { deleteRecipe, recordMade, updateRecipe } = useRecipeStore();
  const [targetServings, setTargetServings] = useState<number>(recipe.servings ?? 2);
  const [recording, setRecording] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editCategory, setEditCategory] = useState(recipe.category ?? "");
  const [editSubcategory, setEditSubcategory] = useState(recipe.subcategory ?? "");
  const [editIngredients, setEditIngredients] = useState(recipe.ingredients ?? "");
  const [editMemo, setEditMemo] = useState(recipe.memo ?? "");
  const [editServings, setEditServings] = useState<string>(recipe.servings != null ? String(recipe.servings) : "");
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [zoomedPhoto, setZoomedPhoto] = useState<string | null>(null);

  const handleDelete = async () => {
    setDeleting(true);
    setDeleteError("");
    try {
      await deleteRecipe(recipe.id);
      onClose();
    } catch (e: unknown) {
      setDeleteError(e instanceof Error ? e.message : "delete failed");
      setDeleting(false);
    }
  };

  const handleMadeIt = async () => {
    setRecording(true);
    await recordMade(recipe.id);
    setRecording(false);
  };

  const handleSaveEdit = async () => {
    setSaving(true);
    await updateRecipe(recipe.id, {
      category: editCategory || null,
      subcategory: editSubcategory || null,
      ingredients: editIngredients || null,
      memo: editMemo || null,
      servings: editServings ? Number(editServings) : null,
    });
    setSaving(false);
    setEditing(false);
  };

  const subcategories = editCategory ? SUBCATEGORIES[editCategory] : null;

  const ratio = recipe.servings ? targetServings / recipe.servings : 1;
  const displayIngredients =
    recipe.ingredients && recipe.servings && targetServings !== recipe.servings
      ? scaleIngredients(recipe.ingredients, ratio)
      : recipe.ingredients;

  return (
    <div className="fixed inset-0 bg-background z-50 flex flex-col">
      <div className="flex-1 overflow-y-auto">
        <div className="px-7 py-6 space-y-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 space-y-2">
              <h2 className="text-[18px] tracking-wide leading-snug">{recipe.title}</h2>
              <div className="flex items-center gap-2">
                <span className="text-[10px] tracking-widest text-muted-foreground uppercase">
                  {recipe.category}{recipe.subcategory ? ` · ${recipe.subcategory}` : ""}
                  {recipe.cook_time_min ? `  ${recipe.cook_time_min} min` : ""}
                </span>
                <button onClick={() => setEditing(e => !e)} className="text-muted-foreground hover:text-foreground">
                  <Pencil size={10} />
                </button>
              </div>
            </div>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground mt-1">
              <X size={16} />
            </button>
          </div>

          {editing && (
            <div className="space-y-4 bg-muted/30 rounded-xl px-4 py-4">
              <div className="flex gap-3">
                <select
                  value={editCategory}
                  onChange={(e) => { setEditCategory(e.target.value); setEditSubcategory(""); }}
                  className="bg-transparent border-b border-foreground/40 pb-0.5 text-[11px] focus:outline-none pr-2"
                >
                  <option value="">—</option>
                  {RECIPE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                {subcategories && (
                  <select
                    value={editSubcategory}
                    onChange={(e) => setEditSubcategory(e.target.value)}
                    className="bg-transparent border-b border-foreground/40 pb-0.5 text-[11px] focus:outline-none pr-2"
                  >
                    <option value="">—</option>
                    {subcategories.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                )}
              </div>
              <div>
                <p className="text-[9px] tracking-widest text-muted-foreground uppercase mb-1">servings</p>
                <input
                  type="number"
                  min={1}
                  value={editServings}
                  onChange={(e) => setEditServings(e.target.value)}
                  className="w-14 bg-transparent border-b border-foreground/40 pb-0.5 text-[12px] focus:outline-none text-center"
                />
              </div>
              <div>
                <p className="text-[9px] tracking-widest text-muted-foreground uppercase mb-1">ingredients</p>
                <textarea
                  value={editIngredients}
                  onChange={(e) => setEditIngredients(e.target.value)}
                  rows={6}
                  className="w-full bg-background rounded px-2 py-1.5 text-[12px] leading-relaxed focus:outline-none resize-none"
                />
              </div>
              <div>
                <p className="text-[9px] tracking-widest text-muted-foreground uppercase mb-1">memo</p>
                <textarea
                  value={editMemo}
                  onChange={(e) => setEditMemo(e.target.value)}
                  rows={3}
                  className="w-full bg-background rounded px-2 py-1.5 text-[12px] leading-relaxed focus:outline-none resize-none"
                />
              </div>
            </div>
          )}

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

          {(recipe.thumbnail_url || (recipe.photo_urls?.length ?? 0) > 0) && (
            <div className="space-y-2">
              <p className="text-[10px] tracking-widest text-muted-foreground uppercase">photo</p>
              {[recipe.thumbnail_url, ...(recipe.photo_urls ?? [])].filter(Boolean).map((url, i) => (
                <button key={i} type="button" onClick={() => setZoomedPhoto(url!)} className="w-full">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url!} alt={recipe.title} className="w-full h-auto rounded" />
                </button>
              ))}
            </div>
          )}

          {zoomedPhoto && (
            <div
              className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center"
              onClick={() => setZoomedPhoto(null)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={zoomedPhoto} alt="" className="max-w-full max-h-full object-contain" />
            </div>
          )}

          {deleteError && <p className="text-[11px] text-red-500">{deleteError}</p>}
          {confirmDelete ? (
            <div className="flex items-center gap-4">
              <p className="text-[11px] text-muted-foreground">delete this recipe?</p>
              <button onClick={handleDelete} disabled={deleting} className="text-[11px] text-red-500 tracking-wider disabled:opacity-40">
                {deleting ? "deleting..." : "yes"}
              </button>
              <button onClick={() => setConfirmDelete(false)} disabled={deleting} className="text-[11px] text-muted-foreground tracking-wider">cancel</button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="text-[11px] text-muted-foreground hover:text-red-500 transition-colors tracking-wider"
            >
              delete
            </button>
          )}
        </div>
      </div>

      {editing && (
        <div className="flex gap-3 px-7 py-4 border-t border-border/30">
          <button
            onClick={handleSaveEdit}
            disabled={saving}
            className="flex items-center gap-1.5 text-[12px] bg-foreground text-background rounded px-4 py-2 disabled:opacity-40"
          >
            {saving ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
            save
          </button>
          <button
            onClick={() => { setEditing(false); setEditIngredients(recipe.ingredients ?? ""); setEditMemo(recipe.memo ?? ""); setEditServings(recipe.servings != null ? String(recipe.servings) : ""); }}
            className="text-[12px] text-muted-foreground px-4 py-2"
          >
            cancel
          </button>
        </div>
      )}
    </div>
  );
}
