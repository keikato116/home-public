"use client";

import { useEffect } from "react";
import { useStravaStore, StravaActivity } from "@/store/stravaStore";

const STRAVA_CLIENT_ID = "247369";
const STRAVA_REDIRECT_URI = "https://homes-lime.vercel.app/api/strava/callback";

function stravaAuthUrl() {
  const params = new URLSearchParams({
    client_id: STRAVA_CLIENT_ID,
    redirect_uri: STRAVA_REDIRECT_URI,
    response_type: "code",
    scope: "activity:read_all",
  });
  return `https://www.strava.com/oauth/authorize?${params}`;
}

function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)}m`;
  return `${(meters / 1000).toFixed(1)}km`;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}`;
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const weekday = d.toLocaleDateString("en-US", { weekday: "short" });
  return `${m}/${day} ${weekday}`;
}

function typeLabel(type: string): string {
  const map: Record<string, string> = {
    Run: "RUN",
    Ride: "RIDE",
    VirtualRide: "RIDE",
    Walk: "WALK",
    Hike: "HIKE",
    Swim: "SWIM",
    WeightTraining: "WEIGHTS",
    Workout: "WORKOUT",
    Yoga: "YOGA",
    EBikeRide: "E-BIKE",
    Rowing: "ROW",
    StairStepper: "STAIRS",
    Skiing: "SKI",
    Snowboard: "SNOWBOARD",
    Soccer: "SOCCER",
    Tennis: "TENNIS",
  };
  return map[type] ?? type.toUpperCase();
}

function ActivityRow({ a }: { a: StravaActivity }) {
  return (
    <div className="py-3 border-b border-border">
      <div className="flex items-baseline justify-between mb-0.5">
        <span className="text-[10px] tracking-[0.2em] text-muted-foreground">{typeLabel(a.type)}</span>
        <span className="text-[10px] text-muted-foreground">{formatDate(a.startDate)}</span>
      </div>
      <div className="flex items-baseline gap-4">
        <span className="text-[14px]">{formatDistance(a.distance)}</span>
        <span className="text-[12px] text-muted-foreground">{formatDuration(a.movingTime)}</span>
        {a.elevationGain > 0 && (
          <span className="text-[12px] text-muted-foreground">↑{Math.round(a.elevationGain)}m</span>
        )}
        {a.averageHeartrate && (
          <span className="text-[12px] text-muted-foreground">{Math.round(a.averageHeartrate)}bpm</span>
        )}
      </div>
      {a.name && (
        <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{a.name}</p>
      )}
    </div>
  );
}

export function WorkoutTab() {
  const { connected, athleteName, activities, loading, load } = useStravaStore();

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="px-7 pt-10 pb-5">
        <p className="text-[10px] tracking-[0.25em] text-muted-foreground uppercase mb-0.5">activity</p>
        <h1 className="text-[30px] font-light tracking-wide">WORKOUT</h1>
        {athleteName && (
          <p className="text-[11px] text-muted-foreground tracking-wide mt-1">{athleteName}</p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-7 pb-8" style={{ scrollbarWidth: "none" }}>
        {loading && (
          <p className="text-[11px] text-muted-foreground tracking-widest">loading...</p>
        )}

        {!loading && !connected && (
          <div className="space-y-4 mt-4">
            <p className="text-[12px] text-muted-foreground">Connect Strava to see your workouts.</p>
            <a
              href={stravaAuthUrl()}
              className="inline-block px-5 py-2 bg-[#FC4C02] text-white text-[11px] tracking-wider rounded-full"
            >
              Connect Strava
            </a>
          </div>
        )}

        {!loading && connected && activities.length === 0 && (
          <p className="text-[11px] text-muted-foreground mt-4">no activities</p>
        )}

        {!loading && connected && activities.map((a) => (
          <ActivityRow key={a.id} a={a} />
        ))}
      </div>
    </div>
  );
}
