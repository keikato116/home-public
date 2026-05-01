"use client";

import { create } from "zustand";
import { createClient } from "@/lib/supabase/client";
import { CalendarEvent, CalendarSettings } from "@/types";
import { fetchCalendarEvents } from "@/lib/calendar";
import { toISODate } from "@/lib/utils";
import { useAuthStore } from "@/store/authStore";

interface CalendarState {
  events: CalendarEvent[];
  settings: CalendarSettings | null;
  loading: boolean;
  error: string | null;
  load: (householdId: string, accessToken: string | null) => Promise<void>;
  updateSettings: (householdId: string, settings: Partial<CalendarSettings>, accessToken: string | null) => Promise<void>;
  eventsByDate: () => Record<string, CalendarEvent[]>;
}

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = localStorage.getItem("google_refresh_token");
  if (!refreshToken) return null;

  const res = await fetch("/api/refresh-token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });

  if (!res.ok) return null;

  const { accessToken } = await res.json();
  localStorage.setItem("google_access_token", accessToken);
  useAuthStore.setState({ accessToken });
  return accessToken;
}

async function fetchWithAutoRefresh(
  token: string,
  colors: string[],
  startDate: string
): Promise<CalendarEvent[]> {
  try {
    return await fetchCalendarEvents(token, colors, startDate);
  } catch (e) {
    if (e instanceof Error && e.message === "TOKEN_EXPIRED") {
      const newToken = await refreshAccessToken();
      if (newToken) return await fetchCalendarEvents(newToken, colors, startDate);
    }
    throw e;
  }
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

    try {
      const events = await fetchWithAutoRefresh(accessToken, settings.selected_colors, settings.start_date);
      set({ events, loading: false });
    } catch (e) {
      const msg = e instanceof Error && e.message === "TOKEN_EXPIRED"
        ? "セッションが切れました。再ログインしてください"
        : "カレンダーの取得に失敗しました";
      set({ loading: false, error: msg });
    }
  },

  updateSettings: async (householdId, partial, accessToken) => {
    const supabase = createClient();
    const current = get().settings ?? { household_id: householdId, selected_colors: [], start_date: toISODate(new Date()) };
    const updated = { ...current, ...partial };

    await supabase.from("calendar_settings").upsert({ ...updated, updated_at: new Date().toISOString() });
    set({ settings: updated });

    if (accessToken) {
      const events = await fetchWithAutoRefresh(accessToken, updated.selected_colors, updated.start_date);
      set({ events });
    }
  },
}));
