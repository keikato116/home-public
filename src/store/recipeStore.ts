"use client";

import { create } from "zustand";
import { createClient } from "@/lib/supabase/client";
import { Recipe } from "@/types";

interface RecipeState {
  recipes: Recipe[];
  loading: boolean;
  load: (householdId: string) => Promise<void>;
  addByUrl: (householdId: string, url: string, userId: string) => Promise<void>;
  addByPhoto: (householdId: string, file: File, title: string, userId: string) => Promise<void>;
  addManual: (householdId: string, title: string, ingredients: string, steps: string, userId: string) => Promise<void>;
  deleteRecipe: (id: string, photoPath: string | null) => Promise<void>;
}

export const useRecipeStore = create<RecipeState>((set) => ({
  recipes: [],
  loading: false,

  load: async (householdId) => {
    set({ loading: true });
    const supabase = createClient();
    const { data } = await supabase
      .from("recipes")
      .select("*")
      .eq("household_id", householdId)
      .order("created_at", { ascending: false });
    set({ recipes: (data ?? []) as Recipe[], loading: false });
  },

  addByUrl: async (householdId, url, userId) => {
    const ogRes = await fetch("/api/recipe/og", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    const { title, thumbnail_url } = ogRes.ok ? await ogRes.json() : { title: url, thumbnail_url: null };

    const supabase = createClient();
    const { data } = await supabase
      .from("recipes")
      .insert({ household_id: householdId, title, source_type: "url", url, thumbnail_url, created_by: userId })
      .select()
      .single();
    if (data) set((s) => ({ recipes: [data as Recipe, ...s.recipes] }));
  },

  addByPhoto: async (householdId, file, title, userId) => {
    const supabase = createClient();
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${householdId}/${crypto.randomUUID()}.${ext}`;

    const { error } = await supabase.storage.from("recipes").upload(path, file);
    if (error) throw error;

    const { data: { publicUrl } } = supabase.storage.from("recipes").getPublicUrl(path);

    const { data } = await supabase
      .from("recipes")
      .insert({ household_id: householdId, title, source_type: "photo", photo_path: path, thumbnail_url: publicUrl, created_by: userId })
      .select()
      .single();
    if (data) set((s) => ({ recipes: [data as Recipe, ...s.recipes] }));
  },

  addManual: async (householdId, title, ingredients, steps, userId) => {
    const supabase = createClient();
    const { data } = await supabase
      .from("recipes")
      .insert({ household_id: householdId, title, source_type: "manual", ingredients, steps, created_by: userId })
      .select()
      .single();
    if (data) set((s) => ({ recipes: [data as Recipe, ...s.recipes] }));
  },

  deleteRecipe: async (id, photoPath) => {
    const supabase = createClient();
    if (photoPath) {
      await supabase.storage.from("recipes").remove([photoPath]);
    }
    await supabase.from("recipes").delete().eq("id", id);
    set((s) => ({ recipes: s.recipes.filter((r) => r.id !== id) }));
  },
}));
