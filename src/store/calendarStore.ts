"use client";

import { create } from "zustand";
import { createClient } from "@/lib/supabase/client";
import { CalendarEvent, CalendarSettings } from "@/types";
import { fetchCalendarEvents } from "@/lib/calendar";
import { toISODate } from "@/lib/utils";

interface CalendarState {
  events: CalendarEvent[];
  settings: CalendarSettings | null;
  loading: boolean;
  error: string | null;
  load: (householdId: string, accessToken: string | null) => Promise<void>;
  updateSettings: (householdId: string, settings: Partial<CalendarSettings>, accessToken: string | null) => Promise<void>;
  eventsByDate: () => Record<string, CalendarEvent[]>;
}

export const useCalendarStore = create<CalendarState>((set, get) => ({
  events: [],
  settings: null,
  loading: false,
  error: null,

  eventsByDate: () => {
    const groups: Record<string, CalendarEvent[]> = {};
    for (const event of get().events) {
      const date = (event.start.dateTime ?? event.start.date ?? "").split("T")[0];
      if (!date) continue;
      if (!groups[date]) groups[date] = [];
      groups[date].push(event);
    }
    return groups;
  },

  load: async (householdId, accessToken) => {
    set({ loading: true, error: null });
    const supabase = createClient();

    const { data: settingsData } = await supabase
      .from("calendar_settings")
      .select("*")
      .eq("household_id", householdId)
      .maybeSingle();

    const settings = (settingsData as CalendarSettings | null) ?? {
      household_id: householdId,
      selected_colors: [],
      start_date: toISODate(new Date()),
    };

    set({ settings });

    if (!accessToken) {
      set({ loading: false, error: "再ログインしてカレンダーを表示してください" });
      return;
    }

    const events = await fetchCalendarEvents(
      accessToken,
      settings.selected_colors,
      settings.start_date
    );

    set({ events, loading: false });
  },

  updateSettings: async (householdId, partial, accessToken) => {
    const supabase = createClient();
    const current = get().settings ?? { household_id: householdId, selected_colors: [], start_date: toISODate(new Date()) };
    const updated = { ...current, ...partial };

    await supabase.from("calendar_settings").upsert({ ...updated, updated_at: new Date().toISOString() });
    set({ settings: updated });

    if (accessToken) {
      const events = await fetchCalendarEvents(accessToken, updated.selected_colors, updated.start_date);
      set({ events });
    }
  },
}));
