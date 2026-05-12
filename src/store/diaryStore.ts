"use client";

import { create } from "zustand";
import { createClient } from "@/lib/supabase/client";
import { DiaryEntry } from "@/types";

interface DiaryState {
  entries: DiaryEntry[];
  loading: boolean;
  load: (userId: string) => Promise<void>;
  addEntry: (householdId: string, userId: string, content: string) => Promise<void>;
  deleteEntry: (id: string) => Promise<void>;
  subscribeRealtime: (userId: string) => () => void;
}

export const useDiaryStore = create<DiaryState>((set) => ({
  entries: [],
  loading: false,

  load: async (userId) => {
    set({ loading: true });
    const supabase = createClient();
    const { data } = await supabase
      .from("diary_entries")
      .select("*")
      .eq("user_id", userId)
      .order("entry_date", { ascending: false })
      .order("created_at", { ascending: false });
    set({ entries: (data ?? []) as DiaryEntry[], loading: false });
  },

  addEntry: async (householdId, userId, content) => {
    const supabase = createClient();
    const today = new Date().toISOString().split("T")[0];
    const { data } = await supabase
      .from("diary_entries")
      .insert({ household_id: householdId, user_id: userId, content, entry_date: today })
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

  subscribeRealtime: (userId) => {
    const supabase = createClient();
    const channel = supabase
      .channel(`diary-${userId}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "diary_entries",
        filter: `user_id=eq.${userId}`,
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
