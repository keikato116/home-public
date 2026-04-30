"use client";

import { create } from "zustand";
import { createClient } from "@/lib/supabase/client";
import { ShoppingItem } from "@/types";

interface ShoppingState {
  items: ShoppingItem[];
  loading: boolean;
  load: (householdId: string) => Promise<void>;
  addItem: (householdId: string, label: string, category: string) => Promise<void>;
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
    const supabase = createClient();
    const { data } = await supabase
      .from("shopping_items")
      .select("*")
      .eq("household_id", householdId)
      .order("done")
      .order("order");
    set({ items: (data ?? []) as ShoppingItem[], loading: false });
  },

  addItem: async (householdId, label, category) => {
    const supabase = createClient();
    const { data } = await supabase
      .from("shopping_items")
      .insert({ household_id: householdId, label, category })
      .select()
      .single();
    if (data) set((s) => ({ items: [...s.items, data as ShoppingItem] }));
  },

  toggleItem: async (id, done) => {
    const supabase = createClient();
    await supabase.from("shopping_items").update({ done }).eq("id", id);
    set((s) => ({ items: s.items.map((i) => (i.id === id ? { ...i, done } : i)) }));
  },

  deleteItem: async (id) => {
    const supabase = createClient();
    await supabase.from("shopping_items").delete().eq("id", id);
    set((s) => ({ items: s.items.filter((i) => i.id !== id) }));
  },

  clearDone: async (householdId) => {
    const supabase = createClient();
    await supabase.from("shopping_items").delete().eq("household_id", householdId).eq("done", true);
    set((s) => ({ items: s.items.filter((i) => !i.done) }));
  },

  subscribeRealtime: (householdId) => {
    const supabase = createClient();
    const channel = supabase
      .channel(`shopping-${householdId}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "shopping_items",
        filter: `household_id=eq.${householdId}`,
      }, (payload) => {
        const { eventType, new: newRow, old: oldRow } = payload;
        set((s) => {
          if (eventType === "INSERT") return { items: [...s.items, newRow as ShoppingItem] };
          if (eventType === "UPDATE") return { items: s.items.map((i) => i.id === (newRow as ShoppingItem).id ? newRow as ShoppingItem : i) };
          if (eventType === "DELETE") return { items: s.items.filter((i) => i.id !== (oldRow as ShoppingItem).id) };
          return s;
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  },
}));
