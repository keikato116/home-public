"use client";

import { create } from "zustand";
import { createClient } from "@/lib/supabase/client";
import { CalendarEvent, CalendarSettings, LocalCalendarEvent } from "@/types";
import { fetchCalendarEvents } from "@/lib/calendar";
import { toISODate } from "@/lib/utils";
import { toJSTDateStr } from "@/lib/dates";
import { LS_GOOGLE_TOKEN, LS_CAL_CACHE_PREFIX } from "@/lib/constants";
import { RUN_COLOR, RIDE_COLOR } from "@/lib/colors";
import { useAuthStore, ensureValidAccessToken } from "@/store/authStore";
import { ensureSession } from "@/lib/supabase/helpers";

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

function taskTypeColor(title: string): string | undefined {
  if (title.startsWith("run:")) return RUN_COLOR;
  if (title.startsWith("ride:")) return RIDE_COLOR;
  return undefined;
}

function localToCalendarEvent(e: LocalCalendarEvent, ownerName?: string): CalendarEvent {
  return {
    id: `local-${e.id}`,
    summary: e.title,
    calendarColor: taskTypeColor(e.title),
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
    const add = (date: string, event: CalendarEvent) => {
      if (!groups[date]) groups[date] = [];
      groups[date].push(event);
    };
    for (const event of get().events) {
      if (!event.start.dateTime && event.start.date) {
        // All-day event: expand to every date it covers.
        // Google API uses exclusive end.date; local events use same date for start/end — always add start.
        const startStr = event.start.date;
        const endStr = event.end.date ?? startStr;
        add(startStr, event);
        const cur = new Date(startStr);
        cur.setUTCDate(cur.getUTCDate() + 1);
        while (cur.toISOString().slice(0, 10) < endStr) {
          add(cur.toISOString().slice(0, 10), event);
          cur.setUTCDate(cur.getUTCDate() + 1);
        }
      } else if (event.start.dateTime) {
        // Timed event: use JST date; also add to all subsequent days the event covers
        const startDate = toJSTDateStr(event.start.dateTime);
        add(startDate, event);
        if (event.end.dateTime) {
          const endDate = toJSTDateStr(event.end.dateTime);
          if (endDate > startDate) {
            const cur = new Date(startDate);
            cur.setUTCDate(cur.getUTCDate() + 1);
            while (cur.toISOString().slice(0, 10) <= endDate) {
              add(cur.toISOString().slice(0, 10), event);
              cur.setUTCDate(cur.getUTCDate() + 1);
            }
          }
        }
      }
    }
    return groups;
  },

  load: async (householdId, accessToken) => {
    if (loadTimeoutId) clearTimeout(loadTimeoutId);
    const myGen = ++loadGeneration;

    // Show localStorage cache immediately so tab feels instant
    const cacheKey = `${LS_CAL_CACHE_PREFIX}${householdId}`;
    const hasExistingEvents = get().events.length > 0;
    if (!hasExistingEvents) {
      try {
        const raw = localStorage.getItem(cacheKey);
        if (raw) {
          set({ events: JSON.parse(raw), loading: false, syncing: true, error: null });
        } else {
          set({ loading: true, syncing: false, error: null });
        }
      } catch {
        set({ loading: true, syncing: false, error: null });
      }
    } else {
      set({ syncing: true, error: null });
    }

    const supabase = createClient();
    await ensureSession();

    // Timeout only when truly showing a spinner (no cache, no existing events)
    const showingSpinner = get().loading;
    if (showingSpinner) {
      loadTimeoutId = setTimeout(() => {
        loadTimeoutId = null;
        if (myGen !== loadGeneration) return;
        loadGeneration++;
        set({ loading: false, syncing: false, error: "calendar fetch timed out" });
      }, 30000);
    }

    try {
      const { user } = useAuthStore.getState();
      const currentUserId = user?.id;

      // Run all Supabase queries in parallel
      const [settingsRes, localRes, tokensRes] = await Promise.all([
        supabase.from("calendar_settings").select("*").eq("household_id", householdId).maybeSingle(),
        supabase.from("local_calendar_events").select("*").eq("household_id", householdId),
        supabase.from("user_tokens").select("user_id, google_access_token, display_name, calendar_colors").eq("household_id", householdId),
      ]);

      const settings = (settingsRes.data as CalendarSettings | null) ?? {
        household_id: householdId,
        selected_colors: [],
        start_date: toISODate(new Date()),
      };
      set({ settings });

      const memberTokens = tokensRes.data ?? [];
      const colorMap: Record<string, string[]> = {};
      const nameMap: Record<string, string> = {};
      for (const m of memberTokens) {
        nameMap[m.user_id] = (m.display_name ?? "").split(" ")[0];
        const colors = (m as { calendar_colors?: string[] | null }).calendar_colors;
        if (colors) colorMap[m.user_id] = colors;
      }
      const localEvents: CalendarEvent[] = ((localRes.data ?? []) as LocalCalendarEvent[]).map(e =>
        localToCalendarEvent(e, e.user_id ? nameMap[e.user_id] : undefined)
      );

      // Proactively get a valid token (refreshes if expired or near expiry)
      const effectiveToken =
        (await ensureValidAccessToken()) ??
        accessToken ??
        localStorage.getItem(LS_GOOGLE_TOKEN);

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
      try { localStorage.setItem(cacheKey, JSON.stringify(allEvents)); } catch { /* storage full */ }
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
    await ensureSession();
    const { user } = useAuthStore.getState();
    const ownerName = (user?.user_metadata?.full_name ?? user?.email ?? "").split(" ")[0];

    const payload = {
      household_id: householdId,
      user_id: userId,
      title,
      event_date: date,
      start_time: startTime ?? null,
      end_time: endTime ?? null,
    };

    // Optimistic: show event immediately
    const tempId = `temp-${Date.now()}`;
    const fakeLocal = { id: tempId, created_at: new Date().toISOString(), ...payload } as LocalCalendarEvent;
    const tempEvent = localToCalendarEvent(fakeLocal, ownerName);
    const sortFn = (a: CalendarEvent, b: CalendarEvent) =>
      (a.start.dateTime ?? a.start.date ?? "").localeCompare(b.start.dateTime ?? b.start.date ?? "");
    set({ events: [...get().events, tempEvent].sort(sortFn) });

    let result = await supabase.from("local_calendar_events").insert(payload).select().single();

    if (result.error) {
      // Session may be stale — refresh and retry once
      await supabase.auth.refreshSession();
      result = await supabase.from("local_calendar_events").insert(payload).select().single();
    }

    // Replace temp with persisted event, or remove on permanent failure
    const withoutTemp = get().events.filter(e => e.id !== tempEvent.id);
    if (result.data) {
      const newEvent = localToCalendarEvent(result.data as LocalCalendarEvent, ownerName);
      set({ events: [...withoutTemp, newEvent].sort(sortFn) });
    } else {
      set({ events: withoutTemp });
    }
  },

  deleteLocalEvent: async (id: string) => {
    const supabase = createClient();
    await ensureSession();
    const rawId = id.replace("local-", "");
    await supabase.from("local_calendar_events").delete().eq("id", rawId);
    set({ events: get().events.filter(e => e.id !== id) });
  },

  updateSettings: async (householdId, partial) => {
    const supabase = createClient();
    await ensureSession();
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
