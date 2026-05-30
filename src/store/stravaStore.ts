"use client";

import { create } from "zustand";

export interface StravaActivity {
  id: number;
  name: string;
  type: string;
  startDate: string;
  distance: number;
  movingTime: number;
  elevationGain: number;
  averageHeartrate: number | null;
  kudosCount: number;
}

interface StravaState {
  connected: boolean;
  athleteName: string | null;
  activities: StravaActivity[];
  loadedMonths: Set<string>;
  loading: boolean;
  error: string | null;
  init: () => Promise<void>;
  loadMonth: (year: number, month: number) => Promise<void>;
  disconnect: () => Promise<void>;
}

async function fetchActivities(after?: number, before?: number): Promise<{ connected: boolean; athleteName?: string; activities?: StravaActivity[]; error?: string }> {
  const params = new URLSearchParams();
  if (after != null) params.set("after", String(after));
  if (before != null) params.set("before", String(before));
  const res = await fetch(`/api/strava/activities?${params}`);
  return res.json();
}

export const useStravaStore = create<StravaState>((set, get) => ({
  connected: false,
  athleteName: null,
  activities: [],
  loadedMonths: new Set(),
  loading: false,
  error: null,

  init: async () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const key = `${year}-${month}`;
    // Mark current month loaded immediately so loadMonth skips it
    set((s) => ({
      loading: true,
      error: null,
      loadedMonths: new Set(Array.from(s.loadedMonths).concat(key)),
    }));
    try {
      // Fetch last 50 activities without date filter to avoid timezone edge cases
      const data = await fetchActivities();
      set((s) => ({
        connected: data.connected ?? false,
        athleteName: data.athleteName ?? s.athleteName,
        activities: mergeActivities(s.activities, data.activities ?? []),
        loading: false,
        error: data.error ?? null,
      }));
    } catch {
      set({ loading: false, error: "fetch_failed" });
    }
  },

  loadMonth: async (year, month) => {
    const key = `${year}-${month}`;
    if (get().loadedMonths.has(key)) return;
    set({ loading: true });
    try {
      const after = Math.floor(new Date(year, month, 1).getTime() / 1000);
      const before = Math.floor(new Date(year, month + 1, 1).getTime() / 1000);
      const data = await fetchActivities(after, before);
      set((s) => ({
        connected: data.connected ?? s.connected,
        athleteName: data.athleteName ?? s.athleteName,
        activities: mergeActivities(s.activities, data.activities ?? []),
        loadedMonths: new Set(Array.from(s.loadedMonths).concat(key)),
        loading: false,
      }));
    } catch {
      set({ loading: false });
    }
  },

  disconnect: async () => {
    await fetch("/api/strava/disconnect", { method: "POST" });
    set({ connected: false, athleteName: null, activities: [], loadedMonths: new Set() });
  },
}));

function mergeActivities(existing: StravaActivity[], incoming: StravaActivity[]): StravaActivity[] {
  const map = new Map(existing.map((a) => [a.id, a]));
  for (const a of incoming) map.set(a.id, a);
  return Array.from(map.values()).sort(
    (a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
  );
}
