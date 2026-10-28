"use client";

import { create } from "zustand";
import { createClient } from "@/lib/supabase/client";
import { SplitSession, FamilyCardTotal, SplitItem, SplitSubscription, SplitUtility, SplitUtilityAmount, SplitSettings } from "@/types";
import { ensureSession, withSessionRetry } from "@/lib/supabase/helpers";

export const DEFAULT_SPLIT_SETTINGS: Omit<SplitSettings, "household_id"> = {
  closing_day: 0,
  her_ratio: 0.5,
};

interface SplitState {
  sessions: SplitSession[];
  /** null = まだ読めていない。読めるまでは既定値で描く。 */
  settings: SplitSettings | null;
  familyTotal: FamilyCardTotal | null;
  subscriptions: SplitSubscription[];
  /** 固定費の項目（通信・電気など） */
  utilities: SplitUtility[];
  /** 表示中の月の固定費の金額。項目の id → 金額 */
  utilityAmounts: Record<string, number>;
  loading: boolean;
  loadSettings: (householdId: string) => Promise<void>;
  saveSettings: (householdId: string, patch: Partial<Omit<SplitSettings, "household_id">>) => Promise<void>;
  load: (householdId: string, from: string, to: string, periodYear: number, periodMonth: number) => Promise<void>;
  addSession: (
    householdId: string,
    data: { date: string; store: string; card: "mine" | "family"; items: SplitItem[]; shared_amount: number; her_ratio?: number }
  ) => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
  updateSessionStore: (id: string, store: string) => Promise<void>;
  updateSessionCard: (id: string, card: "mine" | "family") => Promise<void>;
  setFamilyTotal: (householdId: string, year: number, month: number, total: number) => Promise<void>;
  addSubscription: (householdId: string, data: { name: string; amount: number; card: "mine" | "family" }) => Promise<void>;
  deleteSubscription: (id: string) => Promise<void>;
  updateSubscriptionCard: (id: string, card: "mine" | "family") => Promise<void>;
  addUtility: (householdId: string, name: string) => Promise<void>;
  deleteUtility: (id: string) => Promise<void>;
  updateUtilityCard: (id: string, card: "mine" | "family") => Promise<void>;
  /** amount が null ならその月の入力を消す。month は 0-11。 */
  setUtilityAmount: (householdId: string, utilityId: string, year: number, month: number, amount: number | null) => Promise<void>;
}

export const useSplitStore = create<SplitState>((set, get) => ({
  sessions: [],
  settings: null,
  familyTotal: null,
  subscriptions: [],
  utilities: [],
  utilityAmounts: {},
  loading: false,

  loadSettings: async (householdId) => {
    const supabase = createClient();
    await ensureSession();
    const { data } = await supabase
      .from("split_settings")
      .select("*")
      .eq("household_id", householdId)
      .maybeSingle();

    // 行が無い＝まだ誰も設定していない。既定値で扱う（ここでは書き込まない。
    // 開いただけで行が増えると、設定したのかどうか区別がつかなくなる）
    set({
      settings: (data as SplitSettings | null) ?? { household_id: householdId, ...DEFAULT_SPLIT_SETTINGS },
    });
  },

  saveSettings: async (householdId, patch) => {
    const current = get().settings ?? { household_id: householdId, ...DEFAULT_SPLIT_SETTINGS };
    const next: SplitSettings = { ...current, ...patch, household_id: householdId };
    set({ settings: next });  // 先に反映して待たせない

    const supabase = createClient();
    await ensureSession();
    await supabase.from("split_settings").upsert(
      { ...next, updated_at: new Date().toISOString() },
      { onConflict: "household_id" }
    );
  },

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
        supabase
          .from("split_utilities")
          .select("*")
          .eq("household_id", householdId)
          .order("created_at", { ascending: true }),
        // いまの部屋の分だけが返る（"current pairing only" ポリシー）
        supabase
          .from("split_utility_amounts")
          .select("*")
          .eq("household_id", householdId)
          .eq("year", periodYear)
          .eq("month", periodMonth + 1),
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
      const [sessRes, totRes, subRes, utilRes, utilAmtRes] = results;
      const utilityAmounts: Record<string, number> = {};
      for (const a of (utilAmtRes.data ?? []) as SplitUtilityAmount[]) utilityAmounts[a.utility_id] = a.amount;

      set({
        sessions: (sessRes.data ?? []) as SplitSession[],
        familyTotal: (totRes.data as FamilyCardTotal | null) ?? null,
        subscriptions: (subRes.data ?? []) as SplitSubscription[],
        // 表がまだ無い（マイグレーション前）ときは空として扱う
        utilities: (utilRes.data ?? []) as SplitUtility[],
        utilityAmounts,
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

  updateSessionCard: async (id, card) => {
    set((s) => ({ sessions: s.sessions.map((s) => s.id === id ? { ...s, card } : s) }));
    const supabase = createClient();
    await ensureSession();
    await supabase.from("split_sessions").update({ card }).eq("id", id);
  },

  setFamilyTotal: async (householdId, year, month, total) => {
    const supabase = createClient();
    await ensureSession();
    // 関数経由で書く。相手が入れ替わったあと、前の部屋で入れた同じ月の行は見えないので、
    // クライアントから upsert すると RLS で拒否される（2026-10-28_split_utilities.sql）。
    const { data, error } = await supabase.rpc("set_family_card_total", {
      p_household: householdId, p_year: year, p_month: month + 1, p_total: total,
    });
    if (!error) {
      if (data) set({ familyTotal: data as FamilyCardTotal });
      return;
    }
    if (error.code !== "PGRST202") throw new Error(error.message);
    // マイグレーション前は従来どおり（相手が入れ替わった月は書けない）
    const { data: row } = await supabase
      .from("family_card_totals")
      .upsert(
        { household_id: householdId, year, month: month + 1, total, created_at: new Date().toISOString() },
        { onConflict: "household_id,year,month" }
      )
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

  updateSubscriptionCard: async (id, card) => {
    set((s) => ({ subscriptions: s.subscriptions.map((sub) => sub.id === id ? { ...sub, card } : sub) }));
    const supabase = createClient();
    await ensureSession();
    await supabase.from("split_subscriptions").update({ card }).eq("id", id);
  },
  addUtility: async (householdId, name) => {
    const supabase = createClient();
    await ensureSession();
    const { data: row, error } = await supabase
      .from("split_utilities")
      .insert({ household_id: householdId, name })
      .select()
      .single();
    if (error) throw new Error(error.message);
    if (row) set((s) => ({ utilities: [...s.utilities, row as SplitUtility] }));
  },

  deleteUtility: async (id) => {
    set((s) => {
      const utilityAmounts = { ...s.utilityAmounts };
      delete utilityAmounts[id];
      return { utilities: s.utilities.filter((u) => u.id !== id), utilityAmounts };
    });
    const supabase = createClient();
    await ensureSession();
    await supabase.from("split_utilities").delete().eq("id", id);
  },

  updateUtilityCard: async (id, card) => {
    set((s) => ({ utilities: s.utilities.map((u) => u.id === id ? { ...u, card } : u) }));
    const supabase = createClient();
    await ensureSession();
    await supabase.from("split_utilities").update({ card }).eq("id", id);
  },

  setUtilityAmount: async (householdId, utilityId, year, month, amount) => {
    set((s) => {
      const utilityAmounts = { ...s.utilityAmounts };
      if (amount === null) delete utilityAmounts[utilityId];
      else utilityAmounts[utilityId] = amount;
      return { utilityAmounts };
    });
    const supabase = createClient();
    await ensureSession();
    // 関数経由で書く（setFamilyTotal と同じ理由）
    const { error } = await supabase.rpc("set_split_utility_amount", {
      p_utility: utilityId, p_year: year, p_month: month + 1, p_amount: amount,
    });
    if (!error) return;
    if (error.code !== "PGRST202") throw new Error(error.message);
    if (amount === null) {
      await supabase
        .from("split_utility_amounts")
        .delete()
        .eq("utility_id", utilityId)
        .eq("year", year)
        .eq("month", month + 1);
    } else {
      await supabase
        .from("split_utility_amounts")
        // created_at も更新する。前の部屋で作られた行が残っていると、
        // 書き直しても「いまの部屋の行」にならず表示されないため（family_card_totals と同じ）。
        .upsert(
          { household_id: householdId, utility_id: utilityId, year, month: month + 1, amount, created_at: new Date().toISOString() },
          { onConflict: "utility_id,year,month" }
        );
    }
  },
}));
