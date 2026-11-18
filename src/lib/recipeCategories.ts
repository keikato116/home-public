// レシピの分類（世帯で共有、2段まで）。表は supabase/migrations/2026-11-19_recipe_categories.sql。
//
// レシピは分類の「名前」を持つ（recipes.category / subcategory）。分類の一覧に無い名前の
// レシピもありうる（相手の世帯から持ってきた、古い分類のまま、など）。そういうものも
// 見えなくならないよう、画面のタブは「一覧の分類 ＋ レシピが使っている名前」で作る。

export interface RecipeCategoryRow {
  id: string;
  household_id: string;
  parent_id: string | null;
  name: string;
  /** 最初に入れた分類の元の役割（main・side など）。名前を変えても残る。献立のガチャが使う */
  preset_key: string | null;
  position: number;
  created_at: string;
}

export interface CategoryNode {
  id: string;
  name: string;
  presetKey: string | null;
  position: number;
  children: CategoryNode[];
}

/** 分類の無いレシピのタブ */
export const UNCATEGORIZED = "__uncategorized__";
export const UNCATEGORIZED_LABEL = "未分類";

/** 表がまだ無い（マイグレーション前）・読めないときに使う、今までの分類 */
export const DEFAULT_CATEGORY_TREE: CategoryNode[] = [
  "main", "side", "soup", "rice & bowl", "pasta", "noodles", "dessert", "seasonal", "bento",
].map((name, i) => ({
  id: `default-${name}`,
  name,
  presetKey: name,
  position: i + 1,
  children:
    name === "main"
      ? ["meat", "fish", "others"].map((sub, j) => ({
          id: `default-main-${sub}`, name: sub, presetKey: sub, position: j + 1, children: [],
        }))
      : [],
}));

type Sortable = { position: number; created_at?: string };
const byOrder = (a: Sortable, b: Sortable) =>
  a.position - b.position || (a.created_at ?? "").localeCompare(b.created_at ?? "");

export function buildCategoryTree(rows: RecipeCategoryRow[]): CategoryNode[] {
  const node = (r: RecipeCategoryRow): CategoryNode => ({
    id: r.id, name: r.name, presetKey: r.preset_key, position: r.position, children: [],
  });
  const tops = rows.filter((r) => !r.parent_id).sort(byOrder);
  return tops.map((t) => ({
    ...node(t),
    children: rows.filter((r) => r.parent_id === t.id).sort(byOrder).map(node),
  }));
}

interface Categorized {
  category: string | null;
  subcategory: string | null;
}

/** 上の段のタブ。一覧の順、そのあと一覧に無いがレシピが使っている名前、最後に未分類。 */
export function categoryTabs(tree: CategoryNode[], recipes: Categorized[]): string[] {
  const names = tree.map((c) => c.name);
  const extra = Array.from(
    new Set(recipes.map((r) => r.category).filter((c): c is string => !!c && !names.includes(c)))
  ).sort((a, b) => a.localeCompare(b, "ja"));
  const tabs = [...names, ...extra];
  if (recipes.some((r) => !r.category)) tabs.push(UNCATEGORIZED);
  return tabs;
}

/** 下の段のタブ（その分類の下の分類）。無ければ空。 */
export function subcategoryTabs(tree: CategoryNode[], recipes: Categorized[], category: string): string[] {
  if (category === UNCATEGORIZED) return [];
  const names = tree.find((c) => c.name === category)?.children.map((c) => c.name) ?? [];
  const extra = Array.from(
    new Set(
      recipes
        .filter((r) => r.category === category)
        .map((r) => r.subcategory)
        .filter((s): s is string => !!s && !names.includes(s))
    )
  ).sort((a, b) => a.localeCompare(b, "ja"));
  return [...names, ...extra];
}

/** そのタブに入るレシピか */
export function inCategory(r: Categorized, category: string, subcategory: string | null): boolean {
  if (category === UNCATEGORIZED) return !r.category;
  if (r.category !== category) return false;
  return !subcategory || r.subcategory === subcategory;
}

export function tabLabel(tab: string): string {
  return tab === UNCATEGORIZED ? UNCATEGORIZED_LABEL : tab;
}

/** 元の役割（preset_key）→ いまの名前。名前を変えた分類もガチャで見分けるため */
export function presetNames(tree: CategoryNode[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const c of tree) {
    if (c.presetKey) out[c.presetKey] = c.name;
  }
  return out;
}

/** 選択肢（レシピの編集・取り込み）。今の値が一覧に無ければ、それも残して選べるようにする */
export function categoryChoices(tree: CategoryNode[], current?: string | null): string[] {
  const names = tree.map((c) => c.name);
  return current && !names.includes(current) ? [...names, current] : names;
}

export function subcategoryChoices(tree: CategoryNode[], category: string | null, current?: string | null): string[] {
  const names = tree.find((c) => c.name === category)?.children.map((c) => c.name) ?? [];
  return current && !names.includes(current) ? [...names, current] : names;
}

/**
 * 取り込み（AI・ページの情報）が返す元の分類名（main・meat など）を、世帯のいまの名前に直す。
 * 名前を変えていればそれに、消していれば null（未分類）にする。
 */
export function mapPresetCategory(
  tree: CategoryNode[],
  category: string | null,
  subcategory: string | null
): { category: string | null; subcategory: string | null } {
  if (!category) return { category: null, subcategory: null };
  const top = tree.find((c) => c.presetKey === category) ?? tree.find((c) => c.name === category);
  if (!top) return { category: null, subcategory: null };
  const sub = subcategory
    ? top.children.find((c) => c.presetKey === subcategory) ?? top.children.find((c) => c.name === subcategory)
    : undefined;
  return { category: top.name, subcategory: sub?.name ?? null };
}
