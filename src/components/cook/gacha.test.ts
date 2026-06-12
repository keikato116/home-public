import { describe, it, expect, beforeEach, vi } from "vitest";
import { rollGacha } from "./gacha";
import { Recipe } from "@/types";

function recipe(id: string, category: string): Recipe {
  return {
    id, household_id: "h", title: id, url: null, ingredients: null,
    thumbnail_url: null, photo_urls: null, cook_time_min: null, servings: null,
    category, subcategory: null, memo: null, times_made: 0, last_made_at: null,
    created_by: null, created_at: "",
  };
}

// node env has no localStorage; provide a simple in-memory stub
const store = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => { store.set(k, v); },
  removeItem: (k: string) => { store.delete(k); },
});

describe("rollGacha", () => {
  beforeEach(() => store.clear());

  it("returns null when no eligible recipes exist", () => {
    expect(rollGacha([recipe("a", "soup")])).toBeNull();
  });

  it("returns a combo when only mains and sides exist", () => {
    const result = rollGacha([recipe("m", "main"), recipe("s", "side")]);
    expect(result?.type).toBe("combo");
    if (result?.type === "combo") {
      expect(result.main.id).toBe("m");
      expect(result.side.id).toBe("s");
    }
  });

  it("avoids recently rolled recipes when alternatives exist", () => {
    const pastas = [recipe("p1", "pasta"), recipe("p2", "pasta")];
    const first = rollGacha(pastas);
    expect(first?.type).toBe("single");
    const firstId = first?.type === "single" ? first.recipe.id : "";
    const second = rollGacha(pastas);
    const secondId = second?.type === "single" ? second.recipe.id : "";
    expect(secondId).not.toBe(firstId);
  });

  it("falls back to the full pool when all recipes are in history", () => {
    const pastas = [recipe("p1", "pasta")];
    rollGacha(pastas);
    const again = rollGacha(pastas);
    expect(again?.type).toBe("single");
  });
});
