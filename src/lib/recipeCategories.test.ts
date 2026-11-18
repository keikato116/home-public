import { describe, it, expect } from "vitest";
import {
  buildCategoryTree, categoryTabs, subcategoryTabs, inCategory, presetNames,
  categoryChoices, subcategoryChoices, mapPresetCategory, UNCATEGORIZED, DEFAULT_CATEGORY_TREE, type RecipeCategoryRow,
} from "./recipeCategories";

const row = (id: string, name: string, position: number, parent_id: string | null = null, preset_key: string | null = null): RecipeCategoryRow =>
  ({ id, household_id: "h", parent_id, name, preset_key, position, created_at: `2026-11-19T00:00:0${position}Z` });

const rows = [
  row("b", "副菜", 2, null, "side"),
  row("a", "主菜", 1, null, "main"),
  row("a2", "魚", 2, "a", "fish"),
  row("a1", "肉", 1, "a", "meat"),
  row("c", "作り置き", 3),
];
const tree = buildCategoryTree(rows);

describe("buildCategoryTree", () => {
  it("orders top levels and children by position", () => {
    expect(tree.map((c) => c.name)).toEqual(["主菜", "副菜", "作り置き"]);
    expect(tree[0].children.map((c) => c.name)).toEqual(["肉", "魚"]);
    expect(tree[1].children).toEqual([]);
  });
});

describe("categoryTabs", () => {
  it("adds names used by recipes but missing from the list, then 未分類", () => {
    const recipes = [
      { category: "主菜", subcategory: "肉" },
      { category: "main", subcategory: null },
      { category: null, subcategory: null },
    ];
    expect(categoryTabs(tree, recipes)).toEqual(["主菜", "副菜", "作り置き", "main", UNCATEGORIZED]);
  });
  it("has no 未分類 tab when every recipe has a category", () => {
    expect(categoryTabs(tree, [{ category: "副菜", subcategory: null }])).toEqual(["主菜", "副菜", "作り置き"]);
  });
});

describe("subcategoryTabs", () => {
  it("lists children, then subcategories recipes use", () => {
    const recipes = [{ category: "主菜", subcategory: "卵" }, { category: "副菜", subcategory: "x" }];
    expect(subcategoryTabs(tree, recipes, "主菜")).toEqual(["肉", "魚", "卵"]);
    expect(subcategoryTabs(tree, recipes, UNCATEGORIZED)).toEqual([]);
  });
});

describe("inCategory", () => {
  it("matches the category, the subcategory, and 未分類", () => {
    expect(inCategory({ category: "主菜", subcategory: "肉" }, "主菜", null)).toBe(true);
    expect(inCategory({ category: "主菜", subcategory: "肉" }, "主菜", "魚")).toBe(false);
    expect(inCategory({ category: null, subcategory: null }, UNCATEGORIZED, null)).toBe(true);
    expect(inCategory({ category: "主菜", subcategory: null }, UNCATEGORIZED, null)).toBe(false);
  });
});

describe("presetNames", () => {
  it("maps the original roles to current names", () => {
    expect(presetNames(tree)).toEqual({ main: "主菜", side: "副菜" });
    expect(presetNames(DEFAULT_CATEGORY_TREE).main).toBe("main");
  });
});

describe("choices", () => {
  it("keeps a current value that is no longer in the list", () => {
    expect(categoryChoices(tree, "古い分類")).toEqual(["主菜", "副菜", "作り置き", "古い分類"]);
    expect(categoryChoices(tree, "主菜")).toEqual(["主菜", "副菜", "作り置き"]);
    expect(subcategoryChoices(tree, "主菜", "卵")).toEqual(["肉", "魚", "卵"]);
    expect(subcategoryChoices(tree, "副菜", null)).toEqual([]);
  });
});

describe("mapPresetCategory", () => {
  it("maps original keys to renamed categories", () => {
    expect(mapPresetCategory(tree, "main", "meat")).toEqual({ category: "主菜", subcategory: "肉" });
    expect(mapPresetCategory(tree, "side", null)).toEqual({ category: "副菜", subcategory: null });
  });
  it("drops categories the household deleted", () => {
    expect(mapPresetCategory(tree, "soup", null)).toEqual({ category: null, subcategory: null });
    expect(mapPresetCategory(tree, "main", "others")).toEqual({ category: "主菜", subcategory: null });
    expect(mapPresetCategory(tree, null, null)).toEqual({ category: null, subcategory: null });
  });
});
