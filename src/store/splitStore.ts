"use client";

import { create } from "zustand";
import { createClient } from "@/lib/supabase/client";
import { SplitEntry } from "@/types";

interface SplitState {
  entries: SplitEntry[];
  loading: boolean;
  load: (householdId: string, year: number, month: number) => Promise<void>;
  addEntry: (householdId: string, data: Omit<SplitEntry, "id" | "household_id" | "created_at">) => Promise<void>;
  deleteEntry: (id: string) => Promise<void>;
}

export const useSplitStore = create<SplitState>((set) => ({
  entries: [],
  loading: false,

  load: async (householdId, year, month) => {
    set({ loading: true });
    const supabase = createClient();
    const from = `${year}-${String(month + 1).padStart(2, "0")}-01`;
    const lastDay = new Date(year, month + 1, 0).getDate();
    const to = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    const { data } = await supabase
      .from("split_entries")
      .select("*")
      .eq("household_id", householdId)
      .gte("date", from)
      .lte("date", to)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false });
    set({ entries: (data ?? []) as SplitEntry[], loading: false });
  },

  addEntry: async (householdId, data) => {
    const supabase = createClient();
    const { data: row, error } = await supabase
      .from("split_entries")
      .insert({ household_id: householdId, ...data })
      .select()
      .single();
    if (error) throw new Error(error.message);
    if (row) set((s) => ({ entries: [row as SplitEntry, ...s.entries] }));
  },

  deleteEntry: async (id) => {
    set((s) => ({ entries: s.entries.filter((e) => e.id !== id) }));
    const supabase = createClient();
    await supabase.from("split_entries").delete().eq("id", id);
  },
}));
