"use client";

import { create } from "zustand";
import { createClient } from "@/lib/supabase/client";
import { RoutineDefinition, RoutineTodo, SharedTodo } from "@/types";
import { getTodaysRoutines } from "@/lib/routine";
import { toISODate } from "@/lib/utils";

interface TodoState {
  routineDefinitions: RoutineDefinition[];
  completedRoutineIds: Set<string>;
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
  urgentTodos: [],
  loading: false,

  todaysRoutines: () => {
    const today = new Date();
    const defs = getTodaysRoutines(get().routineDefinitions, today);
    const completed = get().completedRoutineIds;
    return defs.map((d) => ({ ...d, done: completed.has(d.id) }));
  },

  load: async (householdId) => {
    set({ loading: true });
    const supabase = createClient();
    const today = toISODate(new Date());

    const [defsRes, compsRes, todosRes] = await Promise.all([
      supabase.from("routine_definitions").select("*").eq("household_id", householdId).order("order"),
      supabase.from("routine_completions").select("definition_id").eq("household_id", householdId).eq("completed_on", today),
      supabase.from("shared_todos").select("*").eq("household_id", householdId).order("order"),
    ]);

    const defs = (defsRes.data ?? []) as RoutineDefinition[];
    const completedIds = new Set((compsRes.data ?? []).map((c) => c.definition_id));

    const onceIds = defs.filter((d) => d.frequency === "once").map((d) => d.id);
    if (onceIds.length > 0) {
      const { data: onceComps } = await supabase
        .from("routine_completions")
        .select("definition_id")
        .eq("household_id", householdId)
        .in("definition_id", onceIds);
      for (const c of onceComps ?? []) completedIds.add(c.definition_id);
    }

    set({
      routineDefinitions: defs,
      completedRoutineIds: completedIds,
      urgentTodos: (todosRes.data ?? []) as SharedTodo[],
      loading: false,
    });
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
    set((s) => {
      const next = new Set(Array.from(s.completedRoutineIds));
      next.add(definitionId);
      return { completedRoutineIds: next };
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
      return { completedRoutineIds: next };
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
    const supabase = createClient();
    await supabase.from("routine_definitions").delete().eq("id", id);
    set((s) => ({
      routineDefinitions: s.routineDefinitions.filter((d) => d.id !== id),
      completedRoutineIds: (() => {
        const next = new Set(s.completedRoutineIds);
        next.delete(id);
        return next;
      })(),
    }));
  },

  subscribeRealtime: (householdId) => {
    const supabase = createClient();

    const channel = supabase
      .channel(`todos-${householdId}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "shared_todos",
        filter: `household_id=eq.${householdId}`,
      }, (payload) => {
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
        supabase
          .from("routine_completions")
          .select("definition_id")
          .eq("household_id", householdId)
          .eq("completed_on", today)
          .then(({ data }) => {
            set({ completedRoutineIds: new Set((data ?? []).map((c) => c.definition_id)) });
          });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  },
}));
