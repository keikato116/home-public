"use client";

import { create } from "zustand";
import { createClient } from "@/lib/supabase/client";
import { ensureSession } from "@/lib/supabase/helpers";
import { Recipe } from "@/types";

export const RECIPE_CATEGORIES = ["main", "side", "soup", "rice & bowl", "pasta", "noodles", "dessert", "seasonal", "bento"] as const;

export const SUBCATEGORIES: Partial<Record<string, string[]>> = {
  main: ["meat", "fish", "others"],
};

const PRESET_RECIPES: Omit<Recipe, "id" | "household_id" | "times_made" | "last_made_at" | "created_by" | "created_at" | "thumbnail_url" | "photo_urls" | "url" | "subcategory">[] = [
  {
    title: "魚の煮つけ",
    category: "main",
    cook_time_min: 20,
    servings: 4,
    ingredients: `真鯛（あれば骨付き）… 4切れ（1切れ120g）
しょうが … 20g
A 酒 … 150ml
A 水 … 150ml
A しょうゆ … 大さじ3
A みりん … 大さじ2
A 砂糖 … 大さじ1
ししとう … 8本`,
    memo: `★骨付きの切り身のほうが煮崩れしにくい
★魚は霜降りをしてから煮る（臭みを取るため）
★煮る時は中火でサッと煮る
★魚を取り出してから煮汁を煮詰めてかけると甘辛くご飯に合う味つけになる`,
  },
  {
    title: "しらすと野菜の手作りふりかけ",
    category: "side",
    cook_time_min: 20,
    servings: 4,
    ingredients: `青菜の軸（ほうれん草・小松菜・大根の葉など）… 60g
塩 … 小さじ1/4
にんじん … 30g
しらす干し … 80g
油 … 小さじ1
A みりん … 小さじ2
A しょうゆ … 小さじ1
A 塩 … ひとつまみ
かつおパック … 1袋（3g）`,
    memo: `白飯にのせて、おにぎりの具に、パスタに和えても美味しい。`,
  },
  {
    title: "キャベツとささ身の和え物",
    category: "side",
    cook_time_min: 15,
    servings: 4,
    ingredients: `キャベツ … 360g
鶏のささ身 … 2本（140g）
酒 … 大さじ1
A 塩 … 小さじ1/4
A 砂糖 … 小さじ1/4
B ささ身の蒸し汁 … 大さじ1
B しょうゆ … 大さじ1
B 砂糖 … 小さじ1/4
B 白いりごま … 適量`,
    memo: null,
  },
  {
    title: "エビマヨ",
    category: "main",
    cook_time_min: 20,
    servings: 4,
    ingredients: `むきエビ … 300g（殻付きは330〜350gくらい）
A 塩 … 小さじ1/2
A 酒 … 大さじ1
A 片栗粉 … 大さじ1
B 塩 … 小さじ1/6
B 卵白 … 1コ分
B 片栗粉 … 大さじ4〜5
揚げ油 … 適宜
C マヨネーズ … 大さじ4
C ケチャップ … 大さじ1
C レモン汁 … 小さじ1/3
レタス … 2〜3枚`,
    memo: null,
  },
  {
    title: "ワンタンスープ",
    category: "soup",
    cook_time_min: 30,
    servings: 4,
    ingredients: `A 豚ひき肉 … 180g
A 白ねぎ（みじん切り）… 20g
A しょうが（しぼり汁）… 小さじ1/2
A ごま油 … 小さじ1
A しょうゆ … 小さじ1/2
A 片栗粉 … 小さじ2
A 白こしょう … 少々
ワンタンの皮 … 24枚
ほうれん草 … 1束（80g）
スープ … 1000ml
B 酒 … 大さじ1
B しょうゆ … 大さじ1・1/2
B 塩 … 小さじ1/4
B 白こしょう … 少々`,
    memo: `冷凍して3週間くらいOK。豚ひき肉の代わりにあいびき肉や鶏ひき肉でも可。`,
  },
  {
    title: "白菜とツナの中華和え",
    category: "side",
    cook_time_min: 20,
    servings: 4,
    ingredients: `白菜 … 1/8株（240g）
塩 … 小さじ1/4
ツナ（水煮）… 1缶（70g）
塩昆布（せん切りタイプ）… 適量
A ごま油 … 適量
A しょうゆ … 適量
A 酢 … 小さじ1/2`,
    memo: `野菜は塩もみにして千切りでじゃきじゃきした食感に。`,
  },
  {
    title: "からすみのパスタ",
    category: "pasta",
    cook_time_min: 25,
    servings: 4,
    ingredients: `にんにく … 1かけ（10g）
赤唐辛子（乾燥）… 2本
オリーブ油 … 大さじ3
スパゲッティ … 320g
スパゲッティの茹で汁 … 120〜150ml
ボッタルガパウダー（からすみ）… 小さじ4（8g）
塩 … ふたつまみ
イタリアンパセリ … 4枝
オリーブ油（仕上げ用）… 小さじ2
ボッタルガパウダー（仕上げ用）… 小さじ2`,
    memo: `ペペロンチーノベース。パスタ茹でる間ににんにくが焦げそうになったら先に茹で汁を入れて焦げるのをとめる。`,
  },
  {
    title: "シュリンプカクテル",
    category: "side",
    cook_time_min: 20,
    servings: 4,
    ingredients: `エビ（殻付き）… 12尾（240g）
A 白ワイン … 大さじ2
A 塩 … 小さじ1/4
A くず野菜（玉ねぎ・パセリの軸・レモン）… 適量
B トマトケチャップ … 大さじ4
B レモン汁 … 小さじ2
B ホースラディッシュ … 小さじ1〜1・1/2
B ウスターソース … 小さじ1
レモン（スライス）… 適量
イタリアンパセリ … 2枝`,
    memo: `パーティーやおもてなしに。`,
  },
  {
    title: "彩野菜のクリスマスアスピック",
    category: "side",
    servings: 4,
    cook_time_min: null,
    ingredients: `水 … 適量
白ワイン … 適量
玉ねぎ（薄切り）… 20g
にんじんのへタや皮 … 10g
ローリエ … 1枚
板ゼラチン … 適量
彩野菜（にんじん・ブロッコリー・ミニトマトなど）… 適量`,
    memo: `プラスチックカップやグラスカップでも可。前日に作っておくと当日楽。`,
  },
];

interface RecipeState {
  recipes: Recipe[];
  loading: boolean;
  loadError: string | null;
  loadingPreset: boolean;
  load: (householdId: string) => Promise<void>;
  loadPreset: (householdId: string, userId: string) => Promise<void>;
  add: (householdId: string, input: Partial<Recipe> & { title: string }, file?: File) => Promise<void>;
  updateRecipe: (id: string, patch: Partial<Pick<Recipe, "category" | "subcategory" | "title" | "ingredients" | "memo" | "servings">>) => Promise<void>;
  recordMade: (id: string, date?: string) => Promise<void>;
  deleteRecipe: (id: string) => Promise<void>;
}

export const useRecipeStore = create<RecipeState>((set, get) => ({
  recipes: [],
  loading: false,
  loadError: null,
  loadingPreset: false,

  load: async (householdId) => {
    set({ loading: true, loadError: null });
    try {
      const supabase = createClient();
      await ensureSession();
      const { data, error } = await supabase
        .from("recipes")
        .select("id, household_id, title, url, ingredients, thumbnail_url, photo_urls, cook_time_min, servings, category, subcategory, memo, times_made, last_made_at, created_by, created_at")
        .eq("household_id", householdId)
        .order("created_at", { ascending: false });
      if (error) set({ loadError: error.message, loading: false, recipes: [] });
      else set({ recipes: (data ?? []) as Recipe[], loading: false });
    } catch {
      set({ loadError: "failed to load recipes", loading: false });
    }
  },

  loadPreset: async (householdId, userId) => {
    set({ loadingPreset: true });
    const supabase = createClient();
    await ensureSession();
    const existing = get().recipes.map((r) => r.title);
    for (const recipe of PRESET_RECIPES) {
      if (existing.includes(recipe.title)) continue;
      const { data } = await supabase
        .from("recipes")
        .insert({
          household_id: householdId,
          title: recipe.title,
          category: recipe.category ?? null,
          cook_time_min: recipe.cook_time_min ?? null,
          servings: recipe.servings ?? null,
          ingredients: recipe.ingredients ?? null,
          memo: recipe.memo || null,
          url: null,
          thumbnail_url: null,
          created_by: userId,
        })
        .select()
        .single();
      if (data) set((s) => ({ recipes: [data as Recipe, ...s.recipes] }));
    }
    set({ loadingPreset: false });
  },

  add: async (householdId, input, file) => {
    const supabase = createClient();
    await ensureSession();
    let thumbnail_url = input.thumbnail_url ?? null;

    if (file) {
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${householdId}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("recipes").upload(path, file);
      if (uploadError) {
        console.warn("storage upload failed, saving without photo:", uploadError.message);
      } else {
        thumbnail_url = supabase.storage.from("recipes").getPublicUrl(path).data.publicUrl;
      }
    }

    const { data, error } = await supabase
      .from("recipes")
      .insert({
        household_id: householdId,
        title: input.title,
        category: input.category ?? null,
        subcategory: input.subcategory ?? null,
        cook_time_min: input.cook_time_min ?? null,
        servings: input.servings ?? null,
        ingredients: input.ingredients ?? null,
        url: input.url ?? null,
        thumbnail_url,
        photo_urls: input.photo_urls ?? null,
        memo: input.memo ?? null,
        created_by: input.created_by ?? null,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    if (data) set((s) => ({ recipes: [data as Recipe, ...s.recipes] }));
  },

  recordMade: async (id, date) => {
    const supabase = createClient();
    await ensureSession();
    const madeDate = date ?? new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo" }).format(new Date());
    const recipe = get().recipes.find((r) => r.id === id);
    if (!recipe) return;
    const times_made = (recipe.times_made ?? 0) + 1;
    await supabase.from("recipes").update({ times_made, last_made_at: madeDate }).eq("id", id);
    set((s) => ({
      recipes: s.recipes.map((r) => r.id === id ? { ...r, times_made, last_made_at: madeDate } : r),
    }));
  },

  updateRecipe: async (id, patch) => {
    const supabase = createClient();
    await ensureSession();
    await supabase.from("recipes").update(patch).eq("id", id);
    set((s) => ({
      recipes: s.recipes.map((r) => r.id === id ? { ...r, ...patch } : r),
    }));
  },

  deleteRecipe: async (id) => {
    const supabase = createClient();
    await ensureSession();
    const recipe = get().recipes.find((r) => r.id === id);

    await supabase.from("recipes").delete().eq("id", id);
    set((s) => ({ recipes: s.recipes.filter((r) => r.id !== id) }));

    // delete from Storage (best-effort; never throws)
    const urlsToCheck = [
      recipe?.thumbnail_url,
      ...(recipe?.photo_urls ?? []),
    ].filter(Boolean) as string[];
    for (const rawUrl of urlsToCheck) {
      try {
        const stillUsed = get().recipes.some(
          (r) => r.thumbnail_url === rawUrl || r.photo_urls?.includes(rawUrl)
        );
        if (!stillUsed) {
          const parsed = new URL(rawUrl);
          const pathMatch = parsed.pathname.match(/\/object\/public\/recipes\/(.+)/);
          if (pathMatch) {
            await supabase.storage.from("recipes").remove([pathMatch[1]]);
          }
        }
      } catch {
        // ignore storage errors
      }
    }
  },
}));
