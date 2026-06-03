"use client";

import { create } from "zustand";
import { createClient } from "@/lib/supabase/client";
import { MealPlan, isHighlightPlan } from "@/types";

interface MealPlanState {
  plans: MealPlan[];
  loading: boolean;
  load: (householdId: string, year?: number, month?: number) => Promise<void>;
  setMeal: (householdId: string, date: string, mealType: "dinner" | "lunch", recipeId: string | null, label: string | null) => Promise<void>;
  deleteMeal: (id: string) => Promise<void>;
  toggleHighlight: (householdId: string, date: string, mealType: "dinner" | "lunch") => Promise<void>;
}

async function withSessionRetry<T>(
  supabase: ReturnType<typeof createClient>,
  fn: () => Promise<{ data: T | null; error: unknown }>
): Promise<T | null> {
  let result = await fn();
  if (result.error) {
    await supabase.auth.refreshSession();
    result = await fn();
  }
  return result.data;
}

export const useMealPlanStore = create<MealPlanState>((set, get) => ({
  plans: [],
  loading: false,

  load: async (householdId, year, month) => {
    set({ loading: true });
    const supabase = createClient();
    let query = supabase.from("meal_plans").select("*").eq("household_id", householdId);
    if (year != null && month != null) {
      const from = `${year}-${String(month + 1).padStart(2, "0")}-01`;
      const lastDay = new Date(year, month + 1, 0).getDate();
      const to = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
      query = query.gte("date", from).lte("date", to);
    }
    const { data } = await query;
    const serverPlans = (data ?? []) as MealPlan[];
    // Preserve optimistic (temp) plans not yet confirmed in DB
    const serverKeys = new Set(serverPlans.map(p => `${p.date}|${p.meal_type}`));
    const tempPlans = get().plans.filter(
      p => p.id.startsWith("temp-") && !serverKeys.has(`${p.date}|${p.meal_type}`)
    );
    set({ plans: [...serverPlans, ...tempPlans], loading: false });
  },

  setMeal: async (householdId, date, mealType, recipeId, label) => {
    const supabase = createClient();
    // Find existing plan: real plans have recipe_id or label set (not a highlight)
    const existing = get().plans.find(
      (p) => p.date === date && p.meal_type === mealType && !isHighlightPlan(p, mealType)
    );

    if (existing) {
      set((s) => ({ plans: s.plans.map((p) => p.id === existing.id ? { ...existing, recipe_id: recipeId, label } : p) }));
      const data = await withSessionRetry(supabase, () =>
        supabase.from("meal_plans").update({ recipe_id: recipeId, label }).eq("id", existing.id).select().single()
      );
      if (data) {
        set((s) => ({ plans: s.plans.map((p) => p.id === existing.id ? data as MealPlan : p) }));
      } else {
        set((s) => ({ plans: s.plans.map((p) => p.id === existing.id ? existing : p) }));
      }
    } else {
      // If there's a highlight plan for this slot, update it to a real meal
      const highlight = get().plans.find((p) => p.date === date && isHighlightPlan(p, mealType));
      if (highlight) {
        set((s) => ({ plans: s.plans.map((p) => p.id === highlight.id ? { ...highlight, recipe_id: recipeId, label } : p) }));
        const data = await withSessionRetry(supabase, () =>
          supabase.from("meal_plans").update({ recipe_id: recipeId, label }).eq("id", highlight.id).select().single()
        );
        if (data) {
          set((s) => ({ plans: s.plans.map((p) => p.id === highlight.id ? data as MealPlan : p) }));
        } else {
          set((s) => ({ plans: s.plans.map((p) => p.id === highlight.id ? highlight : p) }));
        }
      } else {
        const tempId = `temp-meal-${Date.now()}`;
        const tempPlan: MealPlan = { id: tempId, household_id: householdId, date, meal_type: mealType, recipe_id: recipeId, label, created_at: new Date().toISOString() };
        set((s) => ({ plans: [...s.plans, tempPlan] }));
        const data = await withSessionRetry(supabase, () =>
          supabase.from("meal_plans").insert({ household_id: householdId, date, meal_type: mealType, recipe_id: recipeId, label }).select().single()
        );
        if (data) {
          set((s) => ({ plans: s.plans.map((p) => p.id === tempId ? data as MealPlan : p) }));
        } else {
          set((s) => ({ plans: s.plans.filter((p) => p.id !== tempId) }));
        }
      }
    }
  },

  deleteMeal: async (id) => {
    const supabase = createClient();
    set((s) => ({ plans: s.plans.filter((p) => p.id !== id) }));
    await supabase.from("meal_plans").delete().eq("id", id);
  },

  toggleHighlight: async (householdId, date, mealType) => {
    const supabase = createClient();
    const existing = get().plans.find((p) => p.date === date && isHighlightPlan(p, mealType));
    if (existing) {
      set((s) => ({ plans: s.plans.filter((p) => p.id !== existing.id) }));
      await supabase.from("meal_plans").delete().eq("id", existing.id);
    } else {
      const tempId = `temp-${date}-${mealType}`;
      const tempPlan: MealPlan = { id: tempId, household_id: householdId, date, meal_type: mealType, recipe_id: null, label: null, created_at: new Date().toISOString() };
      set((s) => ({ plans: [...s.plans, tempPlan] }));
      // Store as allowed meal_type ("dinner"/"lunch") with null recipe_id and label
      const data = await withSessionRetry(supabase, () =>
        supabase.from("meal_plans").insert({ household_id: householdId, date, meal_type: mealType, recipe_id: null, label: null }).select().single()
      );
      if (data) {
        set((s) => ({ plans: s.plans.map((p) => p.id === tempId ? data as MealPlan : p) }));
      }
      // On failure: keep the optimistic plan so UI remains consistent
    }
  },
}));
