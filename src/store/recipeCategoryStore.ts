import { create } from "zustand";
import { createClient } from "@/lib/supabase/client";
import { ensureSession } from "@/lib/supabase/helpers";
import { useRecipeStore } from "@/store/recipeStore";
import { useAuthStore } from "@/store/authStore";
import {
  buildCategoryTree, DEFAULT_CATEGORY_TREE, type CategoryNode, type RecipeCategoryRow,
} from "@/lib/recipeCategories";

// レシピの分類（世帯で共有、2段まで）。
// 名前の変更と削除は、世帯のレシピも一緒に書き換える関数（rename_recipe_category /
// delete_recipe_category）を通す。表を直接書き換えるとレシピと食い違うため。

interface RecipeCategoryState {
  tree: CategoryNode[];
  rows: RecipeCategoryRow[];
  /** 表が読めた（＝編集できる）。マイグレーション前は今までの分類で表示だけする */
  editable: boolean;
  loaded: boolean;
  load: () => Promise<void>;
  add: (name: string, parentId: string | null) => Promise<string | null>;
  rename: (id: string, name: string) => Promise<string | null>;
  remove: (id: string) => Promise<string | null>;
  move: (id: string, direction: -1 | 1) => Promise<void>;
}

/** 失敗の理由を、画面に出す文にする */
function messageFor(error: { code?: string; message?: string } | null): string {
  switch (error?.code) {
    case "23505": return "同じ名前の分類がすでにあります";
    case "22023":
    case "23514": return error.message?.includes("too many") ? "分類が多すぎます" : "名前は1〜20文字で入れてください";
    case "42501": return "分類を変えるには加入が必要です";
    case "P0002": return "この分類は見つかりませんでした";
    default: return "うまくいきませんでした。時間をおいてお試しください";
  }
}

export const useRecipeCategoryStore = create<RecipeCategoryState>((set, get) => ({
  tree: DEFAULT_CATEGORY_TREE,
  rows: [],
  editable: false,
  loaded: false,

  load: async () => {
    const householdId = useAuthStore.getState().householdId;
    if (!householdId) return;
    const supabase = createClient();
    await ensureSession();
    // まだ一度も分類を入れていない世帯に、今までの分類を入れる（マイグレーション前は失敗するだけ）
    await supabase.rpc("ensure_recipe_categories");
    const { data, error } = await supabase
      .from("recipe_categories")
      .select("id, household_id, parent_id, name, preset_key, position, created_at")
      .eq("household_id", householdId);
    if (error) {
      set({ tree: DEFAULT_CATEGORY_TREE, rows: [], editable: false, loaded: true });
      return;
    }
    const rows = (data ?? []) as RecipeCategoryRow[];
    set({ rows, tree: buildCategoryTree(rows), editable: true, loaded: true });
  },

  add: async (name, parentId) => {
    const householdId = useAuthStore.getState().householdId;
    const trimmed = name.trim();
    if (!householdId) return messageFor(null);
    if (!trimmed || trimmed.length > 20) return messageFor({ code: "22023" });
    const siblings = get().rows.filter((r) => r.parent_id === parentId);
    const position = siblings.reduce((max, r) => Math.max(max, r.position), 0) + 1;
    const { error } = await createClient()
      .from("recipe_categories")
      .insert({ household_id: householdId, parent_id: parentId, name: trimmed, position });
    if (error) return messageFor(error);
    await get().load();
    return null;
  },

  rename: async (id, name) => {
    const trimmed = name.trim();
    if (!trimmed || trimmed.length > 20) return messageFor({ code: "22023" });
    const { error } = await createClient().rpc("rename_recipe_category", { p_id: id, p_name: trimmed });
    if (error) return messageFor(error);
    // レシピの分類名も書き換わったので、両方読み直す
    await Promise.all([get().load(), useRecipeStore.getState().load()]);
    return null;
  },

  remove: async (id) => {
    const { error } = await createClient().rpc("delete_recipe_category", { p_id: id });
    if (error) return messageFor(error);
    await Promise.all([get().load(), useRecipeStore.getState().load()]);
    return null;
  },

  move: async (id, direction) => {
    const target = get().rows.find((r) => r.id === id);
    if (!target) return;
    const siblings = get().rows
      .filter((r) => r.parent_id === target.parent_id)
      .sort((a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at));
    const i = siblings.findIndex((r) => r.id === id);
    const j = i + direction;
    if (j < 0 || j >= siblings.length) return;
    [siblings[i], siblings[j]] = [siblings[j], siblings[i]];

    // 並びを 1, 2, 3… に振り直し、変わった行だけ書く（同じ番号が並んでいても崩れないように）
    const changed = siblings
      .map((r, k) => ({ id: r.id, position: k + 1, before: r.position }))
      .filter((r) => r.position !== r.before);

    // 先に画面を並べ替える
    const rows = get().rows.map((r) => {
      const c = changed.find((x) => x.id === r.id);
      return c ? { ...r, position: c.position } : r;
    });
    set({ rows, tree: buildCategoryTree(rows) });

    const supabase = createClient();
    const results = await Promise.all(
      changed.map((c) => supabase.from("recipe_categories").update({ position: c.position }).eq("id", c.id))
    );
    if (results.some((r) => r.error)) await get().load();
  },
}));
