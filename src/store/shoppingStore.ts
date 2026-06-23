"use client";

import { create } from "zustand";
import { createClient } from "@/lib/supabase/client";
import { ShoppingItem } from "@/types";
import { ensureSession, subscribeTableChanges } from "@/lib/supabase/helpers";

interface ShoppingState {
  items: ShoppingItem[];
  loading: boolean;
  load: (householdId: string) => Promise<void>;
  addItem: (householdId: string, label: string, category: string, date?: string, userId?: string | null) => Promise<void>;
  toggleItem: (id: string, done: boolean) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
  clearDone: (householdId: string) => Promise<void>;
  subscribeRealtime: (householdId: string) => () => void;
  itemsByCategory: () => Record<string, ShoppingItem[]>;
}

export const useShoppingStore = create<ShoppingState>((set, get) => ({
  items: [],
  loading: false,

  itemsByCategory: () => {
    const groups: Record<string, ShoppingItem[]> = {};
    for (const item of get().items) {
      if (!groups[item.category]) groups[item.category] = [];
      groups[item.category].push(item);
    }
    return groups;
  },

  load: async (householdId) => {
    set({ loading: true });
    try {
      const supabase = createClient();
      await ensureSession();
      const { data } = await supabase
        .from("shopping_items")
        .select("*")
        .eq("household_id", householdId)
        .order("done")
        .order("order");
      set({ items: (data ?? []) as ShoppingItem[], loading: false });
    } catch {
      set({ loading: false });
    }
  },

  addItem: async (householdId, label, category, date, userId) => {
    const supabase = createClient();
    await ensureSession();
    const maxOrder = get().items.reduce((m, i) => Math.max(m, i.order ?? 0), 0);
    const { data, error } = await supabase
      .from("shopping_items")
      .insert({ household_id: householdId, label, category, order: maxOrder + 1, date: date ?? null, ...(userId ? { user_id: userId } : {}) })
      .select()
      .single();
    if (error) throw new Error(error.message);
    if (data) set((s) => ({ items: [...s.items, data as ShoppingItem] }));
  },

  toggleItem: async (id, done) => {
    const supabase = createClient();
    await ensureSession();
    await supabase.from("shopping_items").update({ done }).eq("id", id);
    set((s) => ({ items: s.items.map((i) => (i.id === id ? { ...i, done } : i)) }));
  },

  deleteItem: async (id) => {
    const supabase = createClient();
    await ensureSession();
    await supabase.from("shopping_items").delete().eq("id", id);
    set((s) => ({ items: s.items.filter((i) => i.id !== id) }));
  },

  clearDone: async (householdId) => {
    const supabase = createClient();
    await ensureSession();
    await supabase.from("shopping_items").delete().eq("household_id", householdId).eq("done", true);
    set((s) => ({ items: s.items.filter((i) => !i.done) }));
  },

  subscribeRealtime: (householdId) => {
    return subscribeTableChanges(
      `shopping-${householdId}`, "shopping_items", `household_id=eq.${householdId}`,
      (eventType, newRow, oldRow) => {
        set((s) => {
          if (eventType === "INSERT") return { items: [...s.items, newRow as ShoppingItem] };
          if (eventType === "UPDATE") return { items: s.items.map((i) => i.id === (newRow as ShoppingItem).id ? newRow as ShoppingItem : i) };
          if (eventType === "DELETE") return { items: s.items.filter((i) => i.id !== (oldRow as ShoppingItem).id) };
          return s;
        });
      }
    );
  },
}));
