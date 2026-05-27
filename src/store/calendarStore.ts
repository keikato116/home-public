"use client";

import { create } from "zustand";
import { createClient } from "@/lib/supabase/client";
import { CalendarEvent, CalendarSettings, LocalCalendarEvent } from "@/types";
import { fetchCalendarEvents } from "@/lib/calendar";
import { toISODate } from "@/lib/utils";
import { useAuthStore, ensureValidAccessToken } from "@/store/authStore";

let loadGeneration = 0;
let loadTimeoutId: ReturnType<typeof setTimeout> | null = null;

interface CalendarState {
  events: CalendarEvent[];
  settings: CalendarSettings | null;
  loading: boolean;   // true only on first load when no events exist yet
  syncing: boolean;   // true during background refresh when events already shown
  error: string | null;
  load: (householdId: string, accessToken: string | null) => Promise<void>;
  updateSettings: (householdId: string, settings: Partial<CalendarSettings>) => Promise<void>;
  addLocalEvent: (householdId: string, userId: string, title: string, date: string, startTime?: string, endTime?: string) => Promise<void>;
  deleteLocalEvent: (id: string) => Promise<void>;
  eventsByDate: () => Record<string, CalendarEvent[]>;
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
      const newToken = await ensureValidAccessToken();
      if (newToken && newToken !== token) {
        return await fetchCalendarEvents(newToken, colors, startDate);
      }
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
  syncing: false,
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
    if (loadTimeoutId) clearTimeout(loadTimeoutId);
    const myGen = ++loadGeneration;

    const hasExistingEvents = get().events.length > 0;
    set({
      loading: !hasExistingEvents,
      syncing: hasExistingEvents,
      error: null,
    });

    const supabase = createClient();

    // Only timeout on first load — polling failures are silently ignored
    if (!hasExistingEvents) {
      loadTimeoutId = setTimeout(() => {
        loadTimeoutId = null;
        if (myGen !== loadGeneration) return;
        loadGeneration++; // invalidate any in-flight fetch so its result is discarded
        set({ loading: false, syncing: false, error: "calendar fetch timed out" });
      }, 30000);
    }

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

      const { user } = useAuthStore.getState();
      const currentUserId = user?.id;

      const [{ data: localData }, { data: memberTokens }] = await Promise.all([
        supabase.from("local_calendar_events").select("*").eq("household_id", householdId),
        supabase.from("user_tokens").select("user_id, google_access_token, display_name").eq("household_id", householdId),
      ]);

      // Best-effort: fetch per-user color prefs (requires migration; ignored if column absent)
      const colorMap: Record<string, string[]> = {};
      try {
        const { data: colorRows } = await supabase
          .from("user_tokens")
          .select("user_id, calendar_colors")
          .eq("household_id", householdId);
        for (const row of colorRows ?? []) {
          const colors = (row as { calendar_colors?: string[] | null }).calendar_colors;
          if (colors) colorMap[row.user_id] = colors;
        }
      } catch { /* column not yet migrated — fall back to partner's colors being empty (show all) */ }

      const nameMap: Record<string, string> = {};
      for (const m of memberTokens ?? []) {
        nameMap[m.user_id] = (m.display_name ?? "").split(" ")[0];
      }

      const localEvents: CalendarEvent[] = (localData as LocalCalendarEvent[] ?? []).map(e =>
        localToCalendarEvent(e, e.user_id ? nameMap[e.user_id] : undefined)
      );

      // Proactively get a valid token (refreshes if expired or near expiry)
      const effectiveToken =
        (await ensureValidAccessToken()) ??
        accessToken ??
        localStorage.getItem("google_access_token");

      if (!effectiveToken) {
        if (loadTimeoutId) { clearTimeout(loadTimeoutId); loadTimeoutId = null; }
        if (myGen !== loadGeneration) return;
        localEvents.sort((a, b) => (a.start.dateTime ?? a.start.date ?? "").localeCompare(b.start.dateTime ?? b.start.date ?? ""));
        set({ events: localEvents, loading: false, syncing: false, error: "TOKEN_MISSING" });
        return;
      }

      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
      const fetchFrom = toISODate(oneMonthAgo);

      const currentUserName =
        nameMap[currentUserId ?? ""] ||
        (user?.user_metadata?.full_name ?? user?.email ?? "").split(" ")[0];
      const ownEvents = (await fetchWithAutoRefresh(effectiveToken, settings.selected_colors, fetchFrom)).map(e => ({
        ...e,
        ownerId: currentUserId,
        ownerName: currentUserName,
      }));

      const googleEvents: CalendarEvent[] = [...ownEvents];

      // Fetch partner events via server-side API (bypasses RLS, handles token refresh)
      try {
        const partnerRes = await fetch(
          `/api/partner-calendar?householdId=${encodeURIComponent(householdId)}&from=${fetchFrom}`
        );
        if (partnerRes.ok) {
          const { events: partnerEvents } = await partnerRes.json();
          googleEvents.push(...(partnerEvents as CalendarEvent[]));
        }
      } catch { /* ignore — partner events are best-effort */ }

      const allEvents = [...googleEvents, ...localEvents];
      allEvents.sort((a, b) =>
        (a.start.dateTime ?? a.start.date ?? "").localeCompare(b.start.dateTime ?? b.start.date ?? "")
      );

      if (loadTimeoutId) { clearTimeout(loadTimeoutId); loadTimeoutId = null; }
      if (myGen !== loadGeneration) return;
      set({ events: allEvents, loading: false, syncing: false });
    } catch (e) {
      if (loadTimeoutId) { clearTimeout(loadTimeoutId); loadTimeoutId = null; }
      if (myGen !== loadGeneration) return;
      const isTokenExpired = e instanceof Error && e.message === "TOKEN_EXPIRED";
      if (!hasExistingEvents || isTokenExpired) {
        const msg = isTokenExpired
          ? "TOKEN_EXPIRED"
          : "failed to load calendar";
        set({ loading: false, syncing: false, error: msg });

        if (isTokenExpired) {
          // Silently retry after 3 minutes — the background token refresh may have
          // succeeded by then, allowing calendar load to recover without user action
          setTimeout(() => {
            if (!get().error) return; // already recovered
            const { householdId: hid, accessToken: tok } = useAuthStore.getState();
            if (hid) get().load(hid, tok);
          }, 3 * 60 * 1000);
        }
      } else {
        // Polling network failure: silently keep existing events
        set({ syncing: false });
      }
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
    const { user } = useAuthStore.getState();
    const settingsOp = supabase.from("calendar_settings").upsert({ ...updated, updated_at: new Date().toISOString() });
    if (partial.selected_colors !== undefined && user) {
      await Promise.all([
        settingsOp,
        supabase.from("user_tokens")
          .update({ calendar_colors: partial.selected_colors })
          .eq("user_id", user.id)
          .eq("household_id", householdId),
      ]);
    } else {
      await settingsOp;
    }
    set({ settings: updated });
  },
}));
