"use client";

import { useState, useRef } from "react";
import { useRecipeStore, RECIPE_CATEGORIES, SUBCATEGORIES } from "@/store/recipeStore";
import { useAuthStore } from "@/store/authStore";
import { X, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { ParsedRecipe, analyzePhotos, analyzeUrl, mergeRecipes, uploadRecipeFiles } from "./parsing";

interface Props {
  onClose: () => void;
}

type Mode = "photo" | "url";

export function AddRecipeModal({ onClose }: Props) {
  const [mode, setMode] = useState<Mode>("photo");
  const [url, setUrl] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [recipes, setRecipes] = useState<ParsedRecipe[]>([]);
  const [step, setStep] = useState<"input" | "form">("input");
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeProgress, setAnalyzeProgress] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const { add } = useRecipeStore();
  const { householdId, user, loading: authLoading } = useAuthStore();

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Sort by lastModified ascending so photos appear in the order they were taken
    // (iOS photo picker does not guarantee selection order matches capture order)
    const selected = Array.from(e.target.files ?? []).sort((a, b) => a.lastModified - b.lastModified);
    if (selected.length === 0) return;
    setFiles(selected);
    setPreviews(selected.map((f) => URL.createObjectURL(f)));
  };

  const analyze = async () => {
    setError("");
    setAnalyzing(true);
    try {
      let all: ParsedRecipe[];
      if (mode === "photo") {
        if (files.length === 0) throw new Error("please select a photo");
        all = await analyzePhotos(files, previews, setAnalyzeProgress);
      } else {
        if (!url.trim()) throw new Error("please enter a URL");
        setAnalyzeProgress("analyzing...");
        all = await analyzeUrl(url.trim());
      }
      setRecipes(all);
      setStep("form");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "something went wrong");
    }
    setAnalyzing(false);
    setAnalyzeProgress("");
  };

  const updateRecipe = (i: number, patch: Partial<ParsedRecipe>) =>
    setRecipes((rs) => rs.map((r, idx) => idx === i ? { ...r, ...patch } : r));

  const mergeSelected = () => {
    const selectedIdxs = recipes.map((r, i) => r.selected ? i : -1).filter((i) => i >= 0);
    if (selectedIdxs.length < 2) return;
    const merged: ParsedRecipe = { ...mergeRecipes(selectedIdxs.map((i) => recipes[i])), expanded: true };
    setRecipes((rs) => [
      ...rs.filter((_, i) => !selectedIdxs.includes(i)).map((r) => ({ ...r, expanded: false })),
      merged,
    ]);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!householdId || !user) { setError("not ready, please try again"); return; }
    const toSave = recipes.filter((r) => r.selected && r.title.trim());
    if (toSave.length === 0) { setError("select at least one recipe"); return; }
    setSaving(true);
    setError("");
    try {
      const doSave = async () => {
        let fileUrlMap = new Map<File, string | null>();
        if (mode === "photo") {
          const allFiles = toSave.flatMap((r) => r.sourceFiles ?? []);
          const uniqueFiles = allFiles.filter((f, i) => allFiles.indexOf(f) === i);
          fileUrlMap = await uploadRecipeFiles(householdId, uniqueFiles);
        }
        await Promise.all(toSave.map(async (r) => {
          const uploadedUrls = (r.sourceFiles ?? [])
            .map((f) => fileUrlMap.get(f) ?? null)
            .filter(Boolean) as string[];
          const thumbnail_url = uploadedUrls[0] ?? r.thumbnail_url;
          const photo_urls = uploadedUrls.length > 1 ? uploadedUrls.slice(1) : null;
          await add(householdId, { ...r, title: r.title.trim(), created_by: user.id, thumbnail_url, photo_urls });
        }));
      };

      await Promise.race([
        doSave(),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error("save timed out")), 120000)),
      ]);
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "something went wrong");
    } finally {
      setSaving(false);
    }
  };

  const selectedCount = recipes.filter((r) => r.selected).length;

  return (
    <div className="fixed inset-0 bg-background z-50 flex flex-col">
      <div className="flex-1 overflow-y-auto px-7 py-8">
        <div className="flex items-center justify-between mb-6">
          <p className="text-[10px] tracking-widest text-muted-foreground uppercase">add recipe</p>
          <button onClick={onClose}><X size={16} className="text-muted-foreground hover:text-foreground" /></button>
        </div>

        {step === "input" && (
          <>
            <div className="flex gap-1 mb-6">
              {(["photo", "url"] as Mode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={`text-[10px] tracking-wider px-3 py-1.5 rounded border transition-colors ${
                    mode === m ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>

            <div className="space-y-5">
              {mode === "photo" ? (
                <>
                  <input type="file" accept="image/*" multiple ref={fileRef} onChange={handleFiles} className="hidden" />
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="w-full border border-border rounded aspect-video flex items-center justify-center text-[11px] text-muted-foreground hover:border-foreground/30 overflow-hidden relative"
                  >
                    {previews.length > 0 ? (
                      <div className={`w-full h-full grid gap-0.5 ${previews.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
                        {previews.slice(0, 4).map((p, i) => (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img key={i} src={p} alt="" className="w-full h-full object-cover" />
                        ))}
                      </div>
                    ) : (
                      <span>tap to select photos</span>
                    )}
                    {previews.length > 0 && (
                      <span className="absolute bottom-2 right-2 bg-background/80 text-[10px] px-1.5 py-0.5 rounded">
                        {files.length} photo{files.length > 1 ? "s" : ""}
                      </span>
                    )}
                  </button>
                </>
              ) : (
                <div>
                  <p className="text-[10px] tracking-widest text-muted-foreground uppercase mb-2">url</p>
                  <input
                    autoFocus
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full bg-transparent border-b border-border pb-1 text-[12px] focus:outline-none focus:border-foreground/40 placeholder:text-muted-foreground"
                  />
                </div>
              )}

              {error && <p className="text-[11px] text-red-500">{error}</p>}

              <button
                type="button"
                onClick={analyze}
                disabled={analyzing}
                className="w-full bg-foreground text-background rounded px-4 py-3 text-[12px] tracking-wider disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {analyzing
                  ? <><Loader2 size={13} className="animate-spin" />{analyzeProgress}</>
                  : "analyze"}
              </button>
            </div>
          </>
        )}

        {step === "form" && (
          <form onSubmit={save} className="space-y-4">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setStep("input")}
                className="text-[10px] text-muted-foreground hover:text-foreground tracking-wider"
              >
                ← back
              </button>
              <div className="flex items-center gap-3">
                {recipes.filter((r) => r.selected).length >= 2 && (
                  <button
                    type="button"
                    onClick={mergeSelected}
                    className="text-[10px] border border-border rounded px-2.5 py-1 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    merge selected
                  </button>
                )}
                <p className="text-[10px] text-muted-foreground">
                  {recipes.length} recipe{recipes.length > 1 ? "s" : ""} found
                </p>
              </div>
            </div>

            {recipes.map((r, i) => (
              <div key={i} className="border border-border rounded overflow-hidden">
                <button
                  type="button"
                  onClick={() => updateRecipe(i, { expanded: !r.expanded })}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={r.selected}
                    onChange={(e) => { e.stopPropagation(); updateRecipe(i, { selected: e.target.checked }); }}
                    onClick={(e) => e.stopPropagation()}
                    className="shrink-0"
                  />
                  <span className="flex-1 text-[12px] truncate">{r.title || "(no title)"}</span>
                  {(r.sourceFiles?.length ?? 0) > 1 && (
                    <span className="text-[9px] text-muted-foreground shrink-0">{r.sourceFiles!.length} photos</span>
                  )}
                  {r.expanded
                    ? <ChevronUp size={13} className="text-muted-foreground shrink-0" />
                    : <ChevronDown size={13} className="text-muted-foreground shrink-0" />}
                </button>

                {r.expanded && (
                  <div className="px-4 pb-4 space-y-4 border-t border-border pt-4">
                    {mode === "photo" && (r.previewUrls?.length ?? 0) > 0 && (
                      <div className={`grid gap-1 ${r.previewUrls!.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
                        {r.previewUrls!.map((src, fi) => (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img key={fi} src={src} alt="" className="w-full aspect-video object-cover rounded" />
                        ))}
                      </div>
                    )}
                    <Field label="title">
                      <input
                        type="text"
                        value={r.title}
                        onChange={(e) => updateRecipe(i, { title: e.target.value })}
                        className="w-full bg-transparent border-b border-border pb-1 text-[12px] focus:outline-none focus:border-foreground/40"
                      />
                    </Field>
                    <Field label="category">
                      <select
                        value={r.category ?? ""}
                        onChange={(e) => updateRecipe(i, { category: e.target.value || null, subcategory: null })}
                        className="w-full bg-transparent border-b border-border pb-1 text-[12px] focus:outline-none focus:border-foreground/40"
                      >
                        <option value="">—</option>
                        {RECIPE_CATEGORIES.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </Field>
                    {r.category && SUBCATEGORIES[r.category] && (
                      <Field label="subcategory">
                        <select
                          value={r.subcategory ?? ""}
                          onChange={(e) => updateRecipe(i, { subcategory: e.target.value || null })}
                          className="w-full bg-transparent border-b border-border pb-1 text-[12px] focus:outline-none focus:border-foreground/40"
                        >
                          <option value="">—</option>
                          {SUBCATEGORIES[r.category]!.map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </Field>
                    )}
                    <div className="flex gap-4">
                      <Field label="servings" className="flex-1">
                        <input
                          type="number"
                          min={1}
                          value={r.servings ?? ""}
                          onChange={(e) => updateRecipe(i, { servings: e.target.value ? Number(e.target.value) : null })}
                          className="w-full bg-transparent border-b border-border pb-1 text-[12px] focus:outline-none focus:border-foreground/40"
                        />
                      </Field>
                      <Field label="cook time (min)" className="flex-1">
                        <input
                          type="number"
                          min={1}
                          value={r.cook_time_min ?? ""}
                          onChange={(e) => updateRecipe(i, { cook_time_min: e.target.value ? Number(e.target.value) : null })}
                          className="w-full bg-transparent border-b border-border pb-1 text-[12px] focus:outline-none focus:border-foreground/40"
                        />
                      </Field>
                    </div>
                    <Field label="ingredients">
                      <textarea
                        value={r.ingredients ?? ""}
                        onChange={(e) => updateRecipe(i, { ingredients: e.target.value || null })}
                        rows={5}
                        className="w-full bg-transparent border-b border-border pb-1 text-[12px] focus:outline-none focus:border-foreground/40 resize-none"
                      />
                    </Field>
                  </div>
                )}
              </div>
            ))}

            {error && <p className="text-[11px] text-red-500">{error}</p>}

            <button
              type="submit"
              disabled={saving || authLoading || selectedCount === 0}
              className="w-full bg-foreground text-background rounded px-4 py-3 text-[12px] tracking-wider disabled:opacity-40"
            >
              {authLoading ? "loading..." : saving ? "saving..." : `save ${selectedCount} recipe${selectedCount !== 1 ? "s" : ""}`}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <p className="text-[10px] tracking-widest text-muted-foreground uppercase mb-2">{label}</p>
      {children}
    </div>
  );
}
