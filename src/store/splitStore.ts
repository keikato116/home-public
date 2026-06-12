"use client";

import { create } from "zustand";
import { createClient } from "@/lib/supabase/client";
import { SplitSession, FamilyCardTotal, SplitItem, SplitSubscription } from "@/types";

interface SplitState {
  sessions: SplitSession[];
  familyTotal: FamilyCardTotal | null;
  subscriptions: SplitSubscription[];
  loading: boolean;
  load: (householdId: string, from: string, to: string, periodYear: number, periodMonth: number) => Promise<void>;
  addSession: (
    householdId: string,
    data: { date: string; store: string; card: "mine" | "family"; items: SplitItem[]; shared_amount: number; her_ratio?: number }
  ) => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
  updateSessionStore: (id: string, store: string) => Promise<void>;
  setFamilyTotal: (householdId: string, year: number, month: number, total: number) => Promise<void>;
  addSubscription: (householdId: string, data: { name: string; amount: number; card: "mine" | "family" }) => Promise<void>;
  deleteSubscription: (id: string) => Promise<void>;
}

export const useSplitStore = create<SplitState>((set) => ({
  sessions: [],
  familyTotal: null,
  subscriptions: [],
  loading: false,

  load: async (householdId, from, to, periodYear, periodMonth) => {
    set({ loading: true });
    const supabase = createClient();

    try {
      const [sessRes, totRes, subRes] = await Promise.all([
        supabase
          .from("split_sessions")
          .select("*")
          .eq("household_id", householdId)
          .gte("date", from)
          .lte("date", to)
          .order("date", { ascending: false })
          .order("created_at", { ascending: false }),
        supabase
          .from("family_card_totals")
          .select("*")
          .eq("household_id", householdId)
          .eq("year", periodYear)
          .eq("month", periodMonth + 1)
          .maybeSingle(),
        supabase
          .from("split_subscriptions")
          .select("*")
          .eq("household_id", householdId)
          .eq("active", true)
          .order("created_at", { ascending: true }),
      ]);

      set({
        sessions: (sessRes.data ?? []) as SplitSession[],
        familyTotal: (totRes.data as FamilyCardTotal | null) ?? null,
        subscriptions: (subRes.data ?? []) as SplitSubscription[],
        loading: false,
      });
    } catch {
      set({ loading: false });
    }
  },

  addSession: async (householdId, data) => {
    const supabase = createClient();
    let result = await supabase
      .from("split_sessions")
      .insert({ household_id: householdId, ...data })
      .select()
      .single();
    if (result.error && data.her_ratio !== undefined && result.error.message.includes("her_ratio")) {
      // her_ratio column doesn't exist yet (Phase 6 migration not run);
      // fall back to the legacy __ratio__ item already included in items
      const legacy = { ...data };
      delete legacy.her_ratio;
      result = await supabase
        .from("split_sessions")
        .insert({ household_id: householdId, ...legacy })
        .select()
        .single();
    }
    if (result.error) throw new Error(result.error.message);
    if (result.data) set((s) => ({ sessions: [result.data as SplitSession, ...s.sessions] }));
  },

  deleteSession: async (id) => {
    set((s) => ({ sessions: s.sessions.filter((s) => s.id !== id) }));
    const supabase = createClient();
    await supabase.from("split_sessions").delete().eq("id", id);
  },

  updateSessionStore: async (id, store) => {
    set((s) => ({ sessions: s.sessions.map((s) => s.id === id ? { ...s, store } : s) }));
    const supabase = createClient();
    await supabase.from("split_sessions").update({ store }).eq("id", id);
  },

  setFamilyTotal: async (householdId, year, month, total) => {
    const supabase = createClient();
    const { data: row } = await supabase
      .from("family_card_totals")
      .upsert({ household_id: householdId, year, month: month + 1, total }, { onConflict: "household_id,year,month" })
      .select()
      .single();
    if (row) set({ familyTotal: row as FamilyCardTotal });
  },

  addSubscription: async (householdId, data) => {
    const supabase = createClient();
    const { data: row, error } = await supabase
      .from("split_subscriptions")
      .insert({ household_id: householdId, ...data, active: true })
      .select()
      .single();
    if (error) throw new Error(error.message);
    if (row) set((s) => ({ subscriptions: [...s.subscriptions, row as SplitSubscription] }));
  },

  deleteSubscription: async (id) => {
    set((s) => ({ subscriptions: s.subscriptions.filter((s) => s.id !== id) }));
    const supabase = createClient();
    await supabase.from("split_subscriptions").delete().eq("id", id);
  },
}));
