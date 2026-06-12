"use client";

import { create } from "zustand";
import { createClient } from "@/lib/supabase/client";
import { RoutineDefinition } from "@/types";

interface SettingsState {
  routineDefinitions: RoutineDefinition[];
  loading: boolean;
  load: (householdId: string) => Promise<void>;
  addRoutine: (householdId: string, def: Omit<RoutineDefinition, "id" | "household_id" | "order">) => Promise<void>;
  deleteRoutine: (id: string) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  routineDefinitions: [],
  loading: false,

  load: async (householdId) => {
    set({ loading: true });
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from("routine_definitions")
        .select("*")
        .eq("household_id", householdId)
        .order("order");
      set({ routineDefinitions: (data ?? []) as RoutineDefinition[], loading: false });
    } catch {
      set({ loading: false });
    }
  },

  addRoutine: async (householdId, def) => {
    const supabase = createClient();
    const { data } = await supabase
      .from("routine_definitions")
      .insert({ household_id: householdId, ...def, order: 0 })
      .select()
      .single();
    if (data) set((s) => ({ routineDefinitions: [...s.routineDefinitions, data as RoutineDefinition] }));
  },

  deleteRoutine: async (id) => {
    const supabase = createClient();
    await supabase.from("routine_definitions").delete().eq("id", id);
    set((s) => ({ routineDefinitions: s.routineDefinitions.filter((r) => r.id !== id) }));
  },
}));
