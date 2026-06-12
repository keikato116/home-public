"use client";

import { create } from "zustand";
import { createClient } from "@/lib/supabase/client";
import { RoutineDefinition, RoutineTodo, SharedTodo } from "@/types";
import { ensureSession } from "@/lib/supabase/helpers";
import { getTodaysRoutines, getLastScheduledDate } from "@/lib/routine";
import { toISODate } from "@/lib/utils";

interface TodoState {
  routineDefinitions: RoutineDefinition[];
  completedRoutineIds: Set<string>;
  completedByMap: Record<string, string>; // definitionId → display name
  memberNameMap: Record<string, string>;  // userId → display name
  overdueIds: Set<string>;
  urgentTodos: SharedTodo[];
  loading: boolean;
  todaysRoutines: () => RoutineTodo[];
  load: (householdId: string) => Promise<void>;
  markRoutineDone: (householdId: string, definitionId: string) => Promise<void>;
  markRoutineUndone: (householdId: string, definitionId: string) => Promise<void>;
  addUrgentTodo: (householdId: string, label: string, userId: string) => Promise<void>;
  toggleUrgentTodo: (id: string, done: boolean) => Promise<void>;
  deleteUrgentTodo: (id: string) => Promise<void>;
  addChore: (householdId: string, label: string, repeat: boolean, dayOfWeek?: number, dueDate?: string, userId?: string | null) => Promise<void>;
  deleteChore: (id: string) => Promise<void>;
  subscribeRealtime: (householdId: string) => () => void;
}

export const useTodoStore = create<TodoState>((set, get) => ({
  routineDefinitions: [],
  completedRoutineIds: new Set(),
  completedByMap: {},
  memberNameMap: {},
  overdueIds: new Set(),
  urgentTodos: [],
  loading: false,

  todaysRoutines: () => {
    const today = new Date();
    const todayDefs = getTodaysRoutines(get().routineDefinitions, today);
    const completed = get().completedRoutineIds;
    const overdue = get().overdueIds;
    const todayIds = new Set(todayDefs.map((d) => d.id));

    const todayItems: RoutineTodo[] = todayDefs.map((d) => ({
      ...d, done: completed.has(d.id), overdue: false,
    }));
    const overdueItems: RoutineTodo[] = get().routineDefinitions
      .filter((d) => overdue.has(d.id) && !todayIds.has(d.id))
      .map((d) => ({ ...d, done: completed.has(d.id), overdue: true }));

    return [...overdueItems, ...todayItems];
  },

  load: async (householdId) => {
    set({ loading: true });
    try {
    const supabase = createClient();
    await ensureSession();
    const today = toISODate(new Date());

    const [defsRes, compsRes, todosRes, membersRes] = await Promise.all([
      supabase.from("routine_definitions").select("*").eq("household_id", householdId).order("order"),
      supabase.from("routine_completions").select("definition_id, completed_by").eq("household_id", householdId).eq("completed_on", today),
      supabase.from("shared_todos").select("*").eq("household_id", householdId).order("order"),
      supabase.from("user_tokens").select("user_id, display_name").eq("household_id", householdId),
    ]);

    const memberNameMap: Record<string, string> = {};
    for (const m of membersRes.data ?? []) {
      memberNameMap[m.user_id] = (m.display_name ?? "").split(" ")[0];
    }

    const defs = (defsRes.data ?? []) as RoutineDefinition[];
    const completedIds = new Set<string>();
    const completedByMap: Record<string, string> = {};
    for (const c of compsRes.data ?? []) {
      completedIds.add(c.definition_id);
      if (c.completed_by && memberNameMap[c.completed_by]) {
        completedByMap[c.definition_id] = memberNameMap[c.completed_by];
      }
    }

    const onceIds = defs.filter((d) => d.frequency === "once").map((d) => d.id);
    if (onceIds.length > 0) {
      const { data: onceComps } = await supabase
        .from("routine_completions")
        .select("definition_id, completed_by")
        .eq("household_id", householdId)
        .in("definition_id", onceIds);
      for (const c of onceComps ?? []) {
        completedIds.add(c.definition_id);
        if (c.completed_by && memberNameMap[c.completed_by]) {
          completedByMap[c.definition_id] = memberNameMap[c.completed_by];
        }
      }
    }

    // Compute overdue: routines whose last scheduled date has no completion
    const overdueIds = new Set<string>();
    const now = new Date();
    const todayStr = toISODate(now);

    // once: overdue if due_date < today and not completed
    for (const def of defs.filter((d) => d.frequency === "once")) {
      if (def.due_date && def.due_date < todayStr && !completedIds.has(def.id)) {
        overdueIds.add(def.id);
      }
    }

    // weekly/monthly: check if completed since last scheduled date
    const periodicEntries: { id: string; lastDate: string }[] = [];
    for (const def of defs.filter((d) => d.frequency === "weekly" || d.frequency === "monthly")) {
      if (completedIds.has(def.id)) continue;
      const lastDate = getLastScheduledDate(def, now);
      if (lastDate) periodicEntries.push({ id: def.id, lastDate });
    }
    if (periodicEntries.length > 0) {
      const minDate = periodicEntries.reduce((m, e) => (e.lastDate < m ? e.lastDate : m), periodicEntries[0].lastDate);
      const { data: pastComps } = await supabase
        .from("routine_completions")
        .select("definition_id")
        .eq("household_id", householdId)
        .in("definition_id", periodicEntries.map((e) => e.id))
        .gte("completed_on", minDate);
      const completedSince = new Set(pastComps?.map((c: { definition_id: string }) => c.definition_id) ?? []);
      for (const { id } of periodicEntries) {
        if (!completedSince.has(id)) overdueIds.add(id);
      }
    }

    set({
      routineDefinitions: defs,
      completedRoutineIds: completedIds,
      completedByMap,
      memberNameMap,
      overdueIds,
      urgentTodos: (todosRes.data ?? []) as SharedTodo[],
      loading: false,
    });
    } catch {
      set({ loading: false });
    }
  },

  markRoutineDone: async (householdId, definitionId) => {
    const supabase = createClient();
    const today = toISODate(new Date());
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("routine_completions").upsert({
      household_id: householdId,
      definition_id: definitionId,
      completed_on: today,
      completed_by: user?.id,
    });
    const state = get();
    const displayName = user?.id ? (state.memberNameMap[user.id] ?? (user.user_metadata?.full_name ?? user.email ?? "").split(" ")[0]) : "";
    set((s) => {
      const next = new Set(Array.from(s.completedRoutineIds));
      next.add(definitionId);
      return {
        completedRoutineIds: next,
        completedByMap: { ...s.completedByMap, [definitionId]: displayName },
      };
    });
  },

  markRoutineUndone: async (householdId, definitionId) => {
    const supabase = createClient();
    const today = toISODate(new Date());
    await supabase
      .from("routine_completions")
      .delete()
      .eq("definition_id", definitionId)
      .eq("completed_on", today)
      .eq("household_id", householdId);
    set((s) => {
      const next = new Set(s.completedRoutineIds);
      next.delete(definitionId);
      const restMap = Object.fromEntries(Object.entries(s.completedByMap).filter(([k]) => k !== definitionId));
      return { completedRoutineIds: next, completedByMap: restMap };
    });
  },

  addUrgentTodo: async (householdId, label, userId) => {
    const supabase = createClient();
    const { data } = await supabase
      .from("shared_todos")
      .insert({ household_id: householdId, label, created_by: userId })
      .select()
      .single();
    if (data) {
      set((s) => ({ urgentTodos: [...s.urgentTodos, data as SharedTodo] }));
    }
  },

  toggleUrgentTodo: async (id, done) => {
    const supabase = createClient();
    await supabase.from("shared_todos").update({ done }).eq("id", id);
    set((s) => ({
      urgentTodos: s.urgentTodos.map((t) => (t.id === id ? { ...t, done } : t)),
    }));
  },

  deleteUrgentTodo: async (id) => {
    const supabase = createClient();
    await supabase.from("shared_todos").delete().eq("id", id);
    set((s) => ({ urgentTodos: s.urgentTodos.filter((t) => t.id !== id) }));
  },

  addChore: async (householdId, label, repeat, dayOfWeek, dueDate, userId) => {
    const supabase = createClient();
    const maxOrder = Math.max(0, ...get().routineDefinitions.map((d) => d.order));
    const { data } = await supabase
      .from("routine_definitions")
      .insert({
        household_id: householdId,
        user_id: userId ?? null,
        label,
        frequency: repeat ? "weekly" : "once",
        day_of_week: repeat ? (dayOfWeek ?? 0) : null,
        day_of_month: null,
        due_date: repeat ? null : (dueDate ?? null),
        order: maxOrder + 1,
      })
      .select()
      .single();
    if (data) {
      set((s) => ({ routineDefinitions: [...s.routineDefinitions, data as RoutineDefinition] }));
    }
  },

  deleteChore: async (id) => {
    set((s) => ({
      routineDefinitions: s.routineDefinitions.filter((d) => d.id !== id),
      completedRoutineIds: (() => {
        const next = new Set(s.completedRoutineIds);
        next.delete(id);
        return next;
      })(),
    }));
    const supabase = createClient();
    await supabase.from("routine_definitions").delete().eq("id", id);
  },

  subscribeRealtime: (householdId) => {
    const supabase = createClient();

    const channel = supabase
      .channel(`todos-${householdId}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "routine_definitions",
        filter: `household_id=eq.${householdId}`,
      }, (payload: { eventType: string; new: unknown; old: unknown }) => {
        const { eventType, new: newRow, old: oldRow } = payload;
        set((s) => {
          if (eventType === "INSERT") {
            const def = newRow as RoutineDefinition;
            if (s.routineDefinitions.some((d) => d.id === def.id)) return s;
            return { routineDefinitions: [...s.routineDefinitions, def] };
          }
          if (eventType === "UPDATE") {
            return { routineDefinitions: s.routineDefinitions.map((d) => d.id === (newRow as RoutineDefinition).id ? newRow as RoutineDefinition : d) };
          }
          if (eventType === "DELETE") {
            const deletedId = (oldRow as RoutineDefinition).id;
            const next = new Set(s.completedRoutineIds);
            next.delete(deletedId);
            return {
              routineDefinitions: s.routineDefinitions.filter((d) => d.id !== deletedId),
              completedRoutineIds: next,
            };
          }
          return s;
        });
      })
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "shared_todos",
        filter: `household_id=eq.${householdId}`,
      }, (payload: { eventType: string; new: unknown; old: unknown }) => {
        const { eventType, new: newRow, old: oldRow } = payload;
        set((s) => {
          if (eventType === "INSERT") {
            return { urgentTodos: [...s.urgentTodos, newRow as SharedTodo] };
          } else if (eventType === "UPDATE") {
            return { urgentTodos: s.urgentTodos.map((t) => t.id === (newRow as SharedTodo).id ? newRow as SharedTodo : t) };
          } else if (eventType === "DELETE") {
            return { urgentTodos: s.urgentTodos.filter((t) => t.id !== (oldRow as SharedTodo).id) };
          }
          return s;
        });
      })
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "routine_completions",
        filter: `household_id=eq.${householdId}`,
      }, () => {
        const today = toISODate(new Date());
        const state = get();
        supabase
          .from("routine_completions")
          .select("definition_id, completed_by")
          .eq("household_id", householdId)
          .eq("completed_on", today)
          .then(({ data }: { data: { definition_id: string; completed_by: string | null }[] | null }) => {
            const completedIds = new Set<string>();
            const completedByMap: Record<string, string> = {};
            for (const c of data ?? []) {
              completedIds.add(c.definition_id);
              if (c.completed_by && state.memberNameMap[c.completed_by]) {
                completedByMap[c.definition_id] = state.memberNameMap[c.completed_by];
              }
            }
            set({ completedRoutineIds: completedIds, completedByMap });
          });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  },
}));
