"use client";

import { useState, useRef } from "react";
import { useRecipeStore } from "@/store/recipeStore";
import { useAuthStore } from "@/store/authStore";
import { X } from "lucide-react";

interface Props {
  onClose: () => void;
}

type Mode = "url" | "photo" | "manual";

export function AddRecipeModal({ onClose }: Props) {
  const [mode, setMode] = useState<Mode>("url");
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [ingredients, setIngredients] = useState("");
  const [steps, setSteps] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const { addByUrl, addByPhoto, addManual } = useRecipeStore();
  const { householdId, user } = useAuthStore();

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
    if (!title) setTitle(f.name.replace(/\.[^.]+$/, ""));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!householdId || !user) return;
    setLoading(true);
    setError("");
    try {
      if (mode === "url") {
        if (!url.trim()) throw new Error("URLを入力してください");
        await addByUrl(householdId, url.trim(), user.id);
      } else if (mode === "photo") {
        if (!file) throw new Error("写真を選択してください");
        if (!title.trim()) throw new Error("タイトルを入力してください");
        await addByPhoto(householdId, file, title.trim(), user.id);
      } else {
        if (!title.trim()) throw new Error("タイトルを入力してください");
        await addManual(householdId, title.trim(), ingredients, steps, user.id);
      }
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
    }
    setLoading(false);
  };

  const MODES: { id: Mode; label: string }[] = [
    { id: "url", label: "URL" },
    { id: "photo", label: "写真" },
    { id: "manual", label: "手入力" },
  ];

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex flex-col">
      <div className="flex-1 overflow-y-auto px-7 py-8">
        <div className="flex items-center justify-between mb-6">
          <p className="text-[10px] tracking-widest text-muted-foreground uppercase">add recipe</p>
          <button onClick={onClose}><X size={16} className="text-muted-foreground hover:text-foreground" /></button>
        </div>

        <div className="flex gap-1 mb-6">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setMode(m.id)}
              className={`text-[10px] tracking-wider px-3 py-1.5 rounded border transition-colors ${
                mode === m.id ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="space-y-5">
          {mode === "url" && (
            <div>
              <p className="text-[10px] tracking-widest text-muted-foreground uppercase mb-2">URL</p>
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

          {mode === "photo" && (
            <>
              <div>
                <p className="text-[10px] tracking-widest text-muted-foreground uppercase mb-2">写真</p>
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
                    "タップして選択"
                  )}
                </button>
              </div>
              <div>
                <p className="text-[10px] tracking-widest text-muted-foreground uppercase mb-2">タイトル</p>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="レシピ名"
                  className="w-full bg-transparent border-b border-border pb-1 text-[12px] focus:outline-none focus:border-foreground/40 placeholder:text-muted-foreground"
                />
              </div>
            </>
          )}

          {mode === "manual" && (
            <>
              <div>
                <p className="text-[10px] tracking-widest text-muted-foreground uppercase mb-2">タイトル</p>
                <input
                  autoFocus
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="レシピ名"
                  className="w-full bg-transparent border-b border-border pb-1 text-[12px] focus:outline-none focus:border-foreground/40 placeholder:text-muted-foreground"
                />
              </div>
              <div>
                <p className="text-[10px] tracking-widest text-muted-foreground uppercase mb-2">材料</p>
                <textarea
                  value={ingredients}
                  onChange={(e) => setIngredients(e.target.value)}
                  placeholder="材料を入力..."
                  rows={4}
                  className="w-full bg-transparent border-b border-border pb-1 text-[12px] focus:outline-none focus:border-foreground/40 placeholder:text-muted-foreground resize-none"
                />
              </div>
              <div>
                <p className="text-[10px] tracking-widest text-muted-foreground uppercase mb-2">手順</p>
                <textarea
                  value={steps}
                  onChange={(e) => setSteps(e.target.value)}
                  placeholder="手順を入力..."
                  rows={4}
                  className="w-full bg-transparent border-b border-border pb-1 text-[12px] focus:outline-none focus:border-foreground/40 placeholder:text-muted-foreground resize-none"
                />
              </div>
            </>
          )}

          {error && <p className="text-[11px] text-red-500">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-foreground text-background rounded px-4 py-3 text-[12px] tracking-wider disabled:opacity-40"
          >
            {loading ? "追加中..." : "追加する"}
          </button>
        </form>
      </div>
    </div>
  );
}
