"use client";

import { create } from "zustand";
import { createClient } from "@/lib/supabase/client";
import { DiaryEntry } from "@/types";

interface DiaryState {
  entries: DiaryEntry[];
  loading: boolean;
  load: (householdId: string) => Promise<void>;
  addEntry: (householdId: string, userId: string, authorName: string, content: string) => Promise<void>;
  deleteEntry: (id: string) => Promise<void>;
  subscribeRealtime: (householdId: string) => () => void;
}

export const useDiaryStore = create<DiaryState>((set) => ({
  entries: [],
  loading: false,

  load: async (householdId) => {
    set({ loading: true });
    const supabase = createClient();
    const { data } = await supabase
      .from("diary_entries")
      .select("*")
      .eq("household_id", householdId)
      .order("entry_date", { ascending: false })
      .order("created_at", { ascending: false });
    set({ entries: (data ?? []) as DiaryEntry[], loading: false });
  },

  addEntry: async (householdId, userId, authorName, content) => {
    const supabase = createClient();
    const today = new Date().toISOString().split("T")[0];
    const { data } = await supabase
      .from("diary_entries")
      .insert({ household_id: householdId, user_id: userId, author_name: authorName, content, entry_date: today })
      .select()
      .single();
    if (data) {
      set((s) => ({ entries: [data as DiaryEntry, ...s.entries] }));
    }
  },

  deleteEntry: async (id) => {
    const supabase = createClient();
    await supabase.from("diary_entries").delete().eq("id", id);
    set((s) => ({ entries: s.entries.filter((e) => e.id !== id) }));
  },

  subscribeRealtime: (householdId) => {
    const supabase = createClient();
    const channel = supabase
      .channel(`diary-${householdId}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "diary_entries",
        filter: `household_id=eq.${householdId}`,
      }, (payload) => {
        const { eventType, new: newRow, old: oldRow } = payload;
        set((s) => {
          if (eventType === "INSERT") {
            const entry = newRow as DiaryEntry;
            const exists = s.entries.some((e) => e.id === entry.id);
            if (exists) return s;
            return { entries: [entry, ...s.entries] };
          }
          if (eventType === "DELETE") {
            return { entries: s.entries.filter((e) => e.id !== (oldRow as DiaryEntry).id) };
          }
          return s;
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  },
}));
