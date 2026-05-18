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
  loading: boolean;
  error: string | null;
  load: () => Promise<void>;
  disconnect: () => Promise<void>;
}

export const useStravaStore = create<StravaState>((set) => ({
  connected: false,
  athleteName: null,
  activities: [],
  loading: false,
  error: null,

  load: async () => {
    set({ loading: true, error: null });
    try {
      const res = await fetch("/api/strava/activities");
      const data = await res.json();
      set({
        connected: data.connected ?? false,
        athleteName: data.athleteName ?? null,
        activities: data.activities ?? [],
        loading: false,
        error: data.error ?? null,
      });
    } catch {
      set({ loading: false, error: "fetch_failed" });
    }
  },

  disconnect: async () => {
    await fetch("/api/strava/disconnect", { method: "POST" });
    set({ connected: false, athleteName: null, activities: [] });
  },
}));
