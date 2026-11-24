"use client";

import { create } from "zustand";
import { createClient } from "@/lib/supabase/client";
import { CalendarEvent, CalendarSettings, LocalCalendarEvent } from "@/types";
import { fetchCalendarEvents } from "@/lib/calendar";
import { toISODate } from "@/lib/utils";
import { toJSTDateStr } from "@/lib/dates";
import { LS_GOOGLE_TOKEN, LS_CAL_CACHE_PREFIX } from "@/lib/constants";
import { withSummaries } from "@/lib/calendarEvent";
import { RUN_COLOR, RIDE_COLOR } from "@/lib/colors";
import { useAuthStore, ensureValidAccessToken } from "@/store/authStore";
import { ensureSession } from "@/lib/supabase/helpers";

let loadGeneration = 0;
let loadTimeoutId: ReturnType<typeof setTimeout> | null = null;

// 同じ読み込みを重ねない。
// 起動時は page とホームが同時に load を呼び、タブを開くたびにも呼ばれる。以前は毎回
// 最初からやり直し（前の分は捨てる）ていたので、Google への問い合わせが二重三重になり、
// そのぶん遅かった。走っている読み込みがあればそれを待ち、少し前に読み終えたばかりなら
// 読み直さない（更新ボタン・設定の変更は force で必ず読み直す）。
const FRESH_MS = 15_000;
let inFlight: { householdId: string; promise: Promise<void> } | null = null;
let lastLoaded: { householdId: string; at: number } | null = null;

/** 予定がどこから来たか。届いた順に、その出どころの分だけ差し替えるのに使う */
type Source = "local" | "own" | "partner";
function sourceOf(e: CalendarEvent, me: string | undefined): Source {
  if (e.isLocal) return "local";
  return e.ownerId === me ? "own" : "partner";
}

function byStart(a: CalendarEvent, b: CalendarEvent) {
  return (a.start.dateTime ?? a.start.date ?? "").localeCompare(b.start.dateTime ?? b.start.date ?? "");
}

interface CalendarState {
  events: CalendarEvent[];
  settings: CalendarSettings | null;
  loading: boolean;   // true only on first load when no events exist yet
  syncing: boolean;   // true during background refresh when events already shown
  error: string | null;
  load: (householdId: string, accessToken: string | null, force?: boolean) => Promise<void>;
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

  load: (householdId, accessToken, force = false) => {
    if (inFlight?.householdId === householdId) return inFlight.promise;
    const s = get();
    if (
      !force && !s.error && s.events.length > 0 &&
      lastLoaded?.householdId === householdId && Date.now() - lastLoaded.at < FRESH_MS
    ) {
      return Promise.resolve();
    }
    const promise = loadNow(householdId, accessToken).finally(() => {
      if (inFlight?.promise === promise) inFlight = null;
    });
    inFlight = { householdId, promise };
    return promise;
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
        supabase.from("member_profiles")
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

async function loadNow(householdId: string, accessToken: string | null): Promise<void> {
  const get = useCalendarStore.getState;
  const set = useCalendarStore.setState;
  if (loadTimeoutId) clearTimeout(loadTimeoutId);
  const myGen = ++loadGeneration;

  // Show localStorage cache immediately so tab feels instant
  const cacheKey = `${LS_CAL_CACHE_PREFIX}${householdId}`;
  const hasExistingEvents = get().events.length > 0;
  if (!hasExistingEvents) {
    try {
      const raw = localStorage.getItem(cacheKey);
      if (raw) {
        // キャッシュにも summary の無い予定が残っている。JSON.stringify は
        // undefined のキーを落とすため。ここは取得を待たずに描画されるので、
        // 埋めそこねると開いた瞬間に落ちる。
        set({ events: withSummaries(JSON.parse(raw)), loading: false, syncing: true, error: null });
      } else {
        set({ loading: true, syncing: false, error: null });
      }
    } catch {
      set({ loading: true, syncing: false, error: null });
    }
  } else {
    set({ syncing: true, error: null });
  }

  const { user } = useAuthStore.getState();
  const currentUserId = user?.id;

  // 届いた出どころの分だけ差し替えて、すぐ画面に出す（全部そろうまで待たせない）
  // 一部が出たあとも、残りを読んでいる間は更新ボタンを回しておく
  const apply = (source: Source, list: CalendarEvent[]) => {
    if (myGen !== loadGeneration) return;
    const others = get().events.filter((e) => sourceOf(e, currentUserId) !== source);
    set({ events: [...others, ...list].sort(byStart), loading: false, syncing: true });
  };

  const supabase = createClient();
  await ensureSession();

  // Timeout only when truly showing a spinner (no cache, no existing events)
  if (get().loading) {
    loadTimeoutId = setTimeout(() => {
      loadTimeoutId = null;
      if (myGen !== loadGeneration) return;
      loadGeneration++;
      // 一部でも出せていれば、それを残して止める
      const shown = get().events.length > 0;
      set({ loading: false, syncing: false, error: shown ? null : "calendar fetch timed out" });
    }, 30000);
  }

  const oneMonthAgo = new Date();
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
  const fetchFrom = toISODate(oneMonthAgo);

  // 相手の予定は、こちらの設定や鍵を待たずに最初から取りに行く（サーバーが相手の鍵で取る）。
  // 失敗しても、前に出していた相手の予定は残す（best-effort）。
  const partnerDone = fetch(
    `/api/partner-calendar?householdId=${encodeURIComponent(householdId)}&from=${fetchFrom}`
  )
    .then(async (res) => {
      if (!res.ok) return;
      const { events } = await res.json();
      apply("partner", withSummaries((events ?? []) as CalendarEvent[]));
    })
    .catch(() => { /* ignore — partner events are best-effort */ });

  try {
    // 世帯の設定・自分で入れた予定・名前と、Google の鍵の確認を、すべて同時に
    const [settingsRes, localRes, tokensRes, validToken] = await Promise.all([
      supabase.from("calendar_settings").select("*").eq("household_id", householdId).maybeSingle(),
      supabase.from("local_calendar_events").select("*").eq("household_id", householdId),
      supabase.from("member_profiles").select("user_id, display_name, calendar_colors").eq("household_id", householdId),
      // Proactively get a valid token (refreshes if expired or near expiry)
      ensureValidAccessToken().catch(() => null),
    ]);

    const settings = (settingsRes.data as CalendarSettings | null) ?? {
      household_id: householdId,
      selected_colors: [],
      start_date: toISODate(new Date()),
    };
    set({ settings });

    const nameMap: Record<string, string> = {};
    for (const m of tokensRes.data ?? []) {
      nameMap[m.user_id] = (m.display_name ?? "").split(" ")[0];
    }
    const localEvents: CalendarEvent[] = ((localRes.data ?? []) as LocalCalendarEvent[]).map(e =>
      localToCalendarEvent(e, e.user_id ? nameMap[e.user_id] : undefined)
    );
    apply("local", localEvents);

    const effectiveToken = validToken ?? accessToken ?? localStorage.getItem(LS_GOOGLE_TOKEN);

    if (!effectiveToken) {
      if (loadTimeoutId) { clearTimeout(loadTimeoutId); loadTimeoutId = null; }
      if (myGen !== loadGeneration) return;
      loadGeneration++; // 後から届く相手の予定で上書きしない
      set({ events: [...localEvents].sort(byStart), loading: false, syncing: false, error: "TOKEN_MISSING" });
      return;
    }

    const currentUserName =
      nameMap[currentUserId ?? ""] ||
      (user?.user_metadata?.full_name ?? user?.email ?? "").split(" ")[0];
    const ownEvents = (await fetchWithAutoRefresh(effectiveToken, settings.selected_colors, fetchFrom)).map(e => ({
      ...e,
      ownerId: currentUserId,
      ownerName: currentUserName,
    }));
    apply("own", ownEvents);

    await partnerDone;

    if (loadTimeoutId) { clearTimeout(loadTimeoutId); loadTimeoutId = null; }
    if (myGen !== loadGeneration) return;
    const allEvents = get().events;
    try { localStorage.setItem(cacheKey, JSON.stringify(allEvents)); } catch { /* storage full */ }
    lastLoaded = { householdId, at: Date.now() };
    set({ loading: false, syncing: false });
  } catch (e) {
    if (loadTimeoutId) { clearTimeout(loadTimeoutId); loadTimeoutId = null; }
    if (myGen !== loadGeneration) return;
    loadGeneration++; // 後から届く相手の予定で、止めた表示を動かさない
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
          if (hid) get().load(hid, tok, true);
        }, 3 * 60 * 1000);
      }
    } else {
      // Polling network failure: silently keep existing events
      set({ syncing: false });
    }
  }
}
