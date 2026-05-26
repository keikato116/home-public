"use client";

import { useState, useRef } from "react";
import { useRecipeStore, RECIPE_CATEGORIES } from "@/store/recipeStore";
import { useAuthStore } from "@/store/authStore";
import { X, Loader2 } from "lucide-react";

interface Props {
  onClose: () => void;
}

type Mode = "photo" | "url";

interface ParsedRecipe {
  title: string;
  category: string | null;
  servings: number | null;
  cook_time_min: number | null;
  ingredients: string | null;
  memo: string | null;
  thumbnail_url: string | null;
  url: string | null;
}

const EMPTY: ParsedRecipe = {
  title: "",
  category: "",
  servings: null,
  cook_time_min: null,
  ingredients: null,
  memo: null,
  thumbnail_url: null,
  url: null,
};

export function AddRecipeModal({ onClose }: Props) {
  const [mode, setMode] = useState<Mode>("photo");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [form, setForm] = useState<ParsedRecipe>(EMPTY);
  const [step, setStep] = useState<"input" | "form">("input");
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const { add } = useRecipeStore();
  const { householdId, user } = useAuthStore();

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const analyze = async () => {
    setError("");
    setAnalyzing(true);
    try {
      if (mode === "photo") {
        if (!file) throw new Error("please select a photo");
        const buf = await file.arrayBuffer();
        const bytes = new Uint8Array(buf);
        let binary = "";
        for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
        const base64 = btoa(binary);
        const mediaType = (file.type || "image/jpeg") as "image/jpeg" | "image/png" | "image/webp";
        const res = await fetch("/api/parse-recipe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "photo", imageBase64: base64, mediaType }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "analysis failed");
        setForm({ ...EMPTY, ...data });
      } else {
        if (!url.trim()) throw new Error("please enter a URL");
        const res = await fetch("/api/parse-recipe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "url", url: url.trim() }),
        });
        const data2 = await res.json();
        if (!res.ok) throw new Error(data2.error ?? "analysis failed");
        setForm({ ...EMPTY, ...data2, url: url.trim() });
      }
      setStep("form");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "something went wrong");
    }
    setAnalyzing(false);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!householdId || !user) return;
    if (!form.title.trim()) { setError("title is required"); return; }
    setSaving(true);
    setError("");
    try {
      await add(
        householdId,
        { ...form, title: form.title.trim(), created_by: user.id },
        mode === "photo" && file ? file : undefined,
      );
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "something went wrong");
    }
    setSaving(false);
  };

  const set = <K extends keyof ParsedRecipe>(k: K, v: ParsedRecipe[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex flex-col">
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
                  <input type="file" accept="image/*" ref={fileRef} onChange={handleFile} className="hidden" />
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="w-full border border-border rounded aspect-video flex items-center justify-center text-[11px] text-muted-foreground hover:border-foreground/30 overflow-hidden"
                  >
                    {preview ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={preview} alt="preview" className="w-full h-full object-cover" />
                    ) : (
                      "tap to select photo"
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
                {analyzing ? <><Loader2 size={13} className="animate-spin" /> analyzing...</> : "analyze"}
              </button>
            </div>
          </>
        )}

        {step === "form" && (
          <form onSubmit={save} className="space-y-5">
            <button
              type="button"
              onClick={() => setStep("input")}
              className="text-[10px] text-muted-foreground hover:text-foreground tracking-wider"
            >
              ← back
            </button>

            {(form.thumbnail_url || preview) && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={form.thumbnail_url ?? preview ?? ""}
                alt=""
                className="w-full aspect-video object-cover rounded"
              />
            )}

            <Field label="title">
              <input
                autoFocus
                type="text"
                value={form.title}
                onChange={(e) => set("title", e.target.value)}
                className="w-full bg-transparent border-b border-border pb-1 text-[12px] focus:outline-none focus:border-foreground/40"
              />
            </Field>

            <Field label="category">
              <select
                value={form.category ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value || null }))}
                className="w-full bg-transparent border-b border-border pb-1 text-[12px] focus:outline-none focus:border-foreground/40 text-foreground"
              >
                <option value="">—</option>
                {RECIPE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </Field>

            <div className="flex gap-4">
              <Field label="servings" className="flex-1">
                <input
                  type="number"
                  min={1}
                  value={form.servings ?? ""}
                  onChange={(e) => set("servings", e.target.value ? Number(e.target.value) : null)}
                  className="w-full bg-transparent border-b border-border pb-1 text-[12px] focus:outline-none focus:border-foreground/40"
                />
              </Field>
              <Field label="cook time (min)" className="flex-1">
                <input
                  type="number"
                  min={1}
                  value={form.cook_time_min ?? ""}
                  onChange={(e) => set("cook_time_min", e.target.value ? Number(e.target.value) : null)}
                  className="w-full bg-transparent border-b border-border pb-1 text-[12px] focus:outline-none focus:border-foreground/40"
                />
              </Field>
            </div>

            <Field label="ingredients">
              <textarea
                value={form.ingredients ?? ""}
                onChange={(e) => set("ingredients", e.target.value || null)}
                rows={6}
                className="w-full bg-transparent border-b border-border pb-1 text-[12px] focus:outline-none focus:border-foreground/40 resize-none"
              />
            </Field>

            {mode === "url" && (
              <Field label="url">
                <input
                  type="url"
                  value={form.url ?? ""}
                  onChange={(e) => set("url", e.target.value || null)}
                  className="w-full bg-transparent border-b border-border pb-1 text-[12px] focus:outline-none focus:border-foreground/40"
                />
              </Field>
            )}

            <Field label="memo">
              <textarea
                value={form.memo ?? ""}
                onChange={(e) => set("memo", e.target.value || null)}
                rows={3}
                className="w-full bg-transparent border-b border-border pb-1 text-[12px] focus:outline-none focus:border-foreground/40 resize-none"
              />
            </Field>

            {error && <p className="text-[11px] text-red-500">{error}</p>}

            <button
              type="submit"
              disabled={saving}
              className="w-full bg-foreground text-background rounded px-4 py-3 text-[12px] tracking-wider disabled:opacity-40"
            >
              {saving ? "saving..." : "save recipe"}
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
