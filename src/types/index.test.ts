import { describe, it, expect } from "vitest";
import { isHighlightPlan, MealPlan } from "./index";

function plan(partial: Partial<MealPlan>): MealPlan {
  return {
    id: "1",
    household_id: "h",
    date: "2026-07-04",
    meal_type: "dinner",
    recipe_id: null,
    label: null,
    created_at: "",
    ...partial,
  };
}

describe("isHighlightPlan", () => {
  it("detects the current format: matching meal_type with null recipe and label", () => {
    expect(isHighlightPlan(plan({ meal_type: "dinner" }), "dinner")).toBe(true);
    expect(isHighlightPlan(plan({ meal_type: "lunch" }), "lunch")).toBe(true);
  });

  it("detects the legacy highlight_* format", () => {
    expect(isHighlightPlan(plan({ meal_type: "highlight_dinner" }), "dinner")).toBe(true);
    expect(isHighlightPlan(plan({ meal_type: "highlight_lunch" }), "lunch")).toBe(true);
  });

  it("rejects plans with a recipe or label", () => {
    expect(isHighlightPlan(plan({ meal_type: "dinner", label: "カレー" }), "dinner")).toBe(false);
    expect(isHighlightPlan(plan({ meal_type: "dinner", recipe_id: "r1" }), "dinner")).toBe(false);
  });

  it("rejects mismatched meal types", () => {
    expect(isHighlightPlan(plan({ meal_type: "dinner" }), "lunch")).toBe(false);
    expect(isHighlightPlan(plan({ meal_type: "highlight_dinner" }), "lunch")).toBe(false);
  });
});
