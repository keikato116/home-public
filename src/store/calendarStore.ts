"use client";

import { create } from "zustand";
import { createClient } from "@/lib/supabase/client";
import { CalendarEvent, CalendarSettings, LocalCalendarEvent } from "@/types";
import { fetchCalendarEvents } from "@/lib/calendar";
import { toISODate } from "@/lib/utils";
import { useAuthStore } from "@/store/authStore";

interface CalendarState {
  events: CalendarEvent[];
  settings: CalendarSettings | null;
  loading: boolean;
  error: string | null;
  load: (householdId: string, accessToken: string | null) => Promise<void>;
  updateSettings: (householdId: string, settings: Partial<CalendarSettings>) => Promise<void>;
  addLocalEvent: (householdId: string, userId: string, title: string, date: string, startTime?: string, endTime?: string) => Promise<void>;
  deleteLocalEvent: (id: string) => Promise<void>;
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

function localToCalendarEvent(e: LocalCalendarEvent, ownerName?: string): CalendarEvent {
  return {
    id: `local-${e.id}`,
    summary: e.title,
    start: e.start_time
      ? { dateTime: `${e.event_date}T${e.start_time}:00` }
      : { date: e.event_date },
    end: e.end_time
      ? { dateTime: `${e.event_date}T${e.end_time}:00` }
      : { date: e.event_date },
    ownerId: e.user_id ?? undefined,
    ownerName,
    isLocal: true,
  };
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

    try {
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

      const currentUserId = useAuthStore.getState().user?.id;

      const [{ data: localData }, { data: memberTokens }] = await Promise.all([
        supabase.from("local_calendar_events").select("*").eq("household_id", householdId),
        supabase.from("user_tokens").select("user_id, google_access_token, display_name").eq("household_id", householdId),
      ]);

      const nameMap: Record<string, string> = {};
      for (const m of memberTokens ?? []) {
        nameMap[m.user_id] = (m.display_name ?? "").split(" ")[0];
      }

      const localEvents: CalendarEvent[] = (localData as LocalCalendarEvent[] ?? []).map(e =>
        localToCalendarEvent(e, e.user_id ? nameMap[e.user_id] : undefined)
      );

      if (!accessToken) {
        localEvents.sort((a, b) => (a.start.dateTime ?? a.start.date ?? "").localeCompare(b.start.dateTime ?? b.start.date ?? ""));
        set({ events: localEvents, loading: false, error: "再ログインしてカレンダーを表示してください" });
        return;
      }

      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
      const fetchFrom = toISODate(oneMonthAgo);

      let googleEvents: CalendarEvent[] = [];

      if (memberTokens && memberTokens.length > 0) {
        const results = await Promise.allSettled(
          memberTokens.map(async (member) => {
            if (!member.google_access_token) return [];
            const isCurrentUser = member.user_id === currentUserId;
            let events: CalendarEvent[];
            if (isCurrentUser) {
              events = await fetchWithAutoRefresh(accessToken, settings.selected_colors, fetchFrom);
            } else {
              try {
                events = await fetchCalendarEvents(member.google_access_token, settings.selected_colors, fetchFrom);
              } catch {
                return [];
              }
            }
            return events.map(e => ({
              ...e,
              ownerId: member.user_id,
              ownerName: (member.display_name ?? "").split(" ")[0],
            }));
          })
        );
        for (const r of results) {
          if (r.status === "fulfilled") googleEvents.push(...r.value);
        }
      } else {
        googleEvents = await fetchWithAutoRefresh(accessToken, settings.selected_colors, fetchFrom);
      }

      const allEvents = [...googleEvents, ...localEvents];
      allEvents.sort((a, b) =>
        (a.start.dateTime ?? a.start.date ?? "").localeCompare(b.start.dateTime ?? b.start.date ?? "")
      );

      set({ events: allEvents, loading: false });
    } catch (e) {
      const msg = e instanceof Error && e.message === "TOKEN_EXPIRED"
        ? "セッションが切れました。再ログインしてください"
        : "カレンダーの取得に失敗しました";
      set({ loading: false, error: msg });
    }
  },

  addLocalEvent: async (householdId, userId, title, date, startTime, endTime) => {
    const supabase = createClient();
    const { data } = await supabase
      .from("local_calendar_events")
      .insert({
        household_id: householdId,
        user_id: userId,
        title,
        event_date: date,
        start_time: startTime ?? null,
        end_time: endTime ?? null,
      })
      .select()
      .single();

    if (data) {
      const { user } = useAuthStore.getState();
      const newEvent = localToCalendarEvent(data as LocalCalendarEvent, (user?.user_metadata?.full_name ?? user?.email ?? "").split(" ")[0]);
      const events = [...get().events, newEvent].sort((a, b) =>
        (a.start.dateTime ?? a.start.date ?? "").localeCompare(b.start.dateTime ?? b.start.date ?? "")
      );
      set({ events });
    }
  },

  deleteLocalEvent: async (id: string) => {
    const supabase = createClient();
    const rawId = id.replace("local-", "");
    await supabase.from("local_calendar_events").delete().eq("id", rawId);
    set({ events: get().events.filter(e => e.id !== id) });
  },

  updateSettings: async (householdId, partial) => {
    const supabase = createClient();
    const current = get().settings ?? { household_id: householdId, selected_colors: [], start_date: toISODate(new Date()) };
    const updated = { ...current, ...partial };
    await supabase.from("calendar_settings").upsert({ ...updated, updated_at: new Date().toISOString() });
    set({ settings: updated });
  },
}));
