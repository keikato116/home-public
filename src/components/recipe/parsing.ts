// Recipe analysis / merging / upload logic for AddRecipeModal

export interface ParsedRecipe {
  title: string;
  category: string | null;
  subcategory: string | null;
  servings: number | null;
  cook_time_min: number | null;
  ingredients: string | null;
  memo: string | null;
  thumbnail_url: string | null;
  url: string | null;
  selected: boolean;
  expanded: boolean;
  sourceFiles?: File[];
  previewUrls?: string[];
}

export const makeEmpty = (): ParsedRecipe => ({
  title: "",
  category: null,
  subcategory: null,
  servings: null,
  cook_time_min: null,
  ingredients: null,
  memo: null,
  thumbnail_url: null,
  url: null,
  selected: true,
  expanded: true,
});

export async function fileToBase64(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

/** Merges multi-page recipes into one: first item wins, ingredients concatenated. */
export function mergeRecipes(items: ParsedRecipe[]): ParsedRecipe {
  const mergedIngredients = items.map((r) => r.ingredients).filter(Boolean).join("\n");
  const allFiles = items.flatMap((r) => r.sourceFiles ?? []);
  const uniqueFiles = allFiles.filter((f, i) => allFiles.indexOf(f) === i);
  const mergedPreviews = items.flatMap((r) => r.previewUrls ?? []);
  return {
    ...items[0],
    ingredients: mergedIngredients || null,
    sourceFiles: uniqueFiles,
    previewUrls: mergedPreviews,
  };
}

/** Analyzes photos one by one, then auto-groups recipes spanning multiple pages. */
export async function analyzePhotos(
  files: File[],
  previews: string[],
  onProgress: (msg: string) => void
): Promise<ParsedRecipe[]> {
  const all: ParsedRecipe[] = [];

  // Step 1: analyze each photo individually
  for (let i = 0; i < files.length; i++) {
    onProgress(files.length > 1 ? `analyzing photo ${i + 1} / ${files.length}...` : "analyzing...");
    const base64 = await fileToBase64(files[i]);
    const mediaType = (files[i].type || "image/jpeg") as "image/jpeg" | "image/png" | "image/webp";
    const res = await fetch("/api/parse-recipe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "photo", imageBase64: base64, mediaType }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "analysis failed");
    const parsed = (Array.isArray(data) ? data : [data]) as ParsedRecipe[];
    parsed.forEach((r) => all.push({ ...makeEmpty(), ...r, sourceFiles: [files[i]], previewUrls: [previews[i]], expanded: false }));
  }

  // Step 2: auto-group consecutive recipes that span multiple pages
  if (files.length > 1 && all.length > 1) {
    onProgress("grouping...");
    const groupRes = await fetch("/api/parse-recipe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "group",
        recipes: all.map((r) => ({ title: r.title, ingredients: r.ingredients })),
      }),
    });
    if (groupRes.ok) {
      const raw = await groupRes.json();
      const groups: number[][] = Array.isArray(raw) ? raw : [];
      if (groups.length > 0 && groups.length < all.length) {
        const snapshot = [...all];
        all.length = 0;
        for (const group of groups) {
          if (group.length === 1) {
            all.push({ ...snapshot[group[0]], expanded: all.length === 0 });
          } else {
            all.push({ ...mergeRecipes(group.map((idx) => snapshot[idx])), expanded: all.length === 0 });
          }
        }
      }
    }
  }

  if (all.length > 0) all[0] = { ...all[0], expanded: true };
  return all;
}

export async function analyzeUrl(url: string): Promise<ParsedRecipe[]> {
  const res = await fetch("/api/parse-recipe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "url", url }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "analysis failed");
  const parsed = (Array.isArray(data) ? data : [data]) as ParsedRecipe[];
  return parsed.map((r, i) => ({ ...makeEmpty(), ...r, url, expanded: i === 0 }));
}

/** Uploads files to Supabase storage; failed uploads map to null. */
export async function uploadRecipeFiles(
  householdId: string,
  files: File[]
): Promise<Map<File, string | null>> {
  const { createClient } = await import("@/lib/supabase/client");
  const supabase = createClient();
  const fileUrlMap = new Map<File, string | null>();
  await Promise.allSettled(files.map(async (f) => {
    try {
      const ext = f.name.split(".").pop() ?? "jpg";
      const path = `${householdId}/${crypto.randomUUID()}.${ext}`;
      const uploadPromise = supabase.storage.from("recipes").upload(path, f);
      const uploadTimeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("upload timeout")), 60000)
      );
      await Promise.race([uploadPromise, uploadTimeout]);
      fileUrlMap.set(f, supabase.storage.from("recipes").getPublicUrl(path).data.publicUrl);
    } catch {
      fileUrlMap.set(f, null);
    }
  }));
  return fileUrlMap;
}
