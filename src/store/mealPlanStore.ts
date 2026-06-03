"use client";

import { create } from "zustand";
import { createClient } from "@/lib/supabase/client";
import { MealPlan } from "@/types";

interface MealPlanState {
  plans: MealPlan[];
  loading: boolean;
  load: (householdId: string, year?: number, month?: number) => Promise<void>;
  setMeal: (householdId: string, date: string, mealType: "dinner" | "lunch", recipeId: string | null, label: string | null) => Promise<void>;
  deleteMeal: (id: string) => Promise<void>;
  toggleHighlight: (householdId: string, date: string, mealType: "highlight_dinner" | "highlight_lunch") => Promise<void>;
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
    set({ plans: (data ?? []) as MealPlan[], loading: false });
  },

  setMeal: async (householdId, date, mealType, recipeId, label) => {
    const supabase = createClient();
    const existing = get().plans.find((p) => p.date === date && p.meal_type === mealType);
    if (existing) {
      const { data } = await supabase
        .from("meal_plans")
        .update({ recipe_id: recipeId, label })
        .eq("id", existing.id)
        .select()
        .single();
      if (data) set((s) => ({ plans: s.plans.map((p) => p.id === existing.id ? data as MealPlan : p) }));
    } else {
      const { data } = await supabase
        .from("meal_plans")
        .insert({ household_id: householdId, date, meal_type: mealType, recipe_id: recipeId, label })
        .select()
        .single();
      if (data) set((s) => ({ plans: [...s.plans, data as MealPlan] }));
    }
  },

  deleteMeal: async (id) => {
    const supabase = createClient();
    await supabase.from("meal_plans").delete().eq("id", id);
    set((s) => ({ plans: s.plans.filter((p) => p.id !== id) }));
  },

  toggleHighlight: async (householdId, date, mealType) => {
    const supabase = createClient();
    const existing = get().plans.find((p) => p.date === date && p.meal_type === mealType);
    if (existing) {
      set((s) => ({ plans: s.plans.filter((p) => p.id !== existing.id) }));
      await supabase.from("meal_plans").delete().eq("id", existing.id);
    } else {
      const tempId = `temp-${date}-${mealType}`;
      const tempPlan: MealPlan = { id: tempId, household_id: householdId, date, meal_type: mealType, recipe_id: null, label: null, created_at: new Date().toISOString() };
      set((s) => ({ plans: [...s.plans, tempPlan] }));
      const { data } = await supabase
        .from("meal_plans")
        .insert({ household_id: householdId, date, meal_type: mealType, recipe_id: null, label: null })
        .select()
        .single();
      if (data) {
        set((s) => ({ plans: s.plans.map((p) => p.id === tempId ? data as MealPlan : p) }));
      }
    }
  },
}));
