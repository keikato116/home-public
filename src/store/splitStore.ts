"use client";

import { create } from "zustand";
import { createClient } from "@/lib/supabase/client";
import { SplitSession, FamilyCardTotal, SplitItem, SplitSubscription } from "@/types";
import { ensureSession, withSessionRetry } from "@/lib/supabase/helpers";

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
    await ensureSession();

    const runQueries = () =>
      Promise.all([
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

    try {
      // A request over a connection killed during background suspension aborts
      // after the fetch timeout; the retry uses a fresh connection and succeeds.
      let results;
      try {
        results = await runQueries();
      } catch {
        results = await runQueries();
      }
      const [sessRes, totRes, subRes] = results;

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
    await ensureSession();
    const row = await withSessionRetry<SplitSession>(supabase, () =>
      supabase.from("split_sessions").insert({ household_id: householdId, ...data }).select().single()
    );
    if (row) set((s) => ({ sessions: [row, ...s.sessions] }));
    else throw new Error("save failed");
  },

  deleteSession: async (id) => {
    set((s) => ({ sessions: s.sessions.filter((s) => s.id !== id) }));
    const supabase = createClient();
    await ensureSession();
    await supabase.from("split_sessions").delete().eq("id", id);
  },

  updateSessionStore: async (id, store) => {
    set((s) => ({ sessions: s.sessions.map((s) => s.id === id ? { ...s, store } : s) }));
    const supabase = createClient();
    await ensureSession();
    await supabase.from("split_sessions").update({ store }).eq("id", id);
  },

  setFamilyTotal: async (householdId, year, month, total) => {
    const supabase = createClient();
    await ensureSession();
    const { data: row } = await supabase
      .from("family_card_totals")
      .upsert({ household_id: householdId, year, month: month + 1, total }, { onConflict: "household_id,year,month" })
      .select()
      .single();
    if (row) set({ familyTotal: row as FamilyCardTotal });
  },

  addSubscription: async (householdId, data) => {
    const supabase = createClient();
    await ensureSession();
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
    await ensureSession();
    await supabase.from("split_subscriptions").delete().eq("id", id);
  },
}));
