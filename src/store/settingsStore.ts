"use client";

import { create } from "zustand";
import { createClient } from "@/lib/supabase/client";
import { ensureSession } from "@/lib/supabase/helpers";
import { useTodoStore } from "@/store/todoStore";
import { RoutineDefinition } from "@/types";

interface SettingsState {
  routineDefinitions: RoutineDefinition[];
  loading: boolean;
  load: (householdId: string) => Promise<void>;
  addRoutine: (householdId: string, def: Omit<RoutineDefinition, "id" | "household_id" | "order">) => Promise<void>;
  deleteRoutine: (id: string) => Promise<void>;
  /** 通知時刻を設定する。null にするとその家事は通知しない（既定の時刻は無い）。 */
  setRoutineNotifyAt: (id: string, notifyAt: string | null) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  routineDefinitions: [],
  loading: false,

  load: async (householdId) => {
    set({ loading: true });
    try {
      const supabase = createClient();
      await ensureSession();
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
    await ensureSession();
    const { data } = await supabase
      .from("routine_definitions")
      .insert({ household_id: householdId, ...def, order: 0 })
      .select()
      .single();
    if (data) set((s) => ({ routineDefinitions: [...s.routineDefinitions, data as RoutineDefinition] }));
  },

  setRoutineNotifyAt: async (id, notifyAt) => {
    const supabase = createClient();
    await ensureSession();
    await supabase.from("routine_definitions").update({ notify_at: notifyAt }).eq("id", id);
    set((s) => ({
      routineDefinitions: s.routineDefinitions.map((r) =>
        r.id === id ? { ...r, notify_at: notifyAt } : r
      ),
    }));
    // 同じ行を todoStore も持っている。通知の予約は home タブが todoStore を見て
    // 組み直すので、ここを更新しないと、設定で時刻を変えたあと home に戻った時点で
    // 古い時刻で予約し直されてしまう（タブは表示のたびに作り直される）。
    // realtime で伝わりそうに見えるが、routine_definitions は publication に
    // 入っていないので届かない。
    useTodoStore.setState((s) => ({
      routineDefinitions: s.routineDefinitions.map((r) =>
        r.id === id ? { ...r, notify_at: notifyAt } : r
      ),
    }));
  },

  deleteRoutine: async (id) => {
    const supabase = createClient();
    await ensureSession();
    await supabase.from("routine_definitions").delete().eq("id", id);
    set((s) => ({ routineDefinitions: s.routineDefinitions.filter((r) => r.id !== id) }));
  },
}));
