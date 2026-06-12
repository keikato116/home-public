"use client";

import { useEffect, useState } from "react";
import { useStravaStore, StravaActivity } from "@/store/stravaStore";
import { cn } from "@/lib/utils";
import { STRAVA_REDIRECT_URI } from "@/lib/constants";

const STRAVA_CLIENT_ID = "248914";

function stravaAuthUrl() {
  const redirectUri = encodeURIComponent(STRAVA_REDIRECT_URI);
  return `https://www.strava.com/oauth/authorize?client_id=${STRAVA_CLIENT_ID}&redirect_uri=${redirectUri}&response_type=code&scope=activity:read_all&approval_prompt=force`;
}

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

function toDateKey(iso: string) {
  return iso.slice(0, 10);
}

function typeColor(type: string): string {
  const map: Record<string, string> = {
    Run: "bg-orange-400", TrailRun: "bg-orange-500",
    Ride: "bg-blue-400", VirtualRide: "bg-blue-300", EBikeRide: "bg-blue-300",
    Walk: "bg-green-400", Hike: "bg-green-500",
    Swim: "bg-cyan-400", WeightTraining: "bg-purple-400",
    Workout: "bg-purple-300", Yoga: "bg-pink-300", Rowing: "bg-teal-400",
  };
  return map[type] ?? "bg-foreground/40";
}

function typeLabel(type: string): string {
  const map: Record<string, string> = {
    Run: "RUN", TrailRun: "TRAIL RUN", Ride: "RIDE", VirtualRide: "RIDE",
    EBikeRide: "E-BIKE", Walk: "WALK", Hike: "HIKE", Swim: "SWIM",
    WeightTraining: "WEIGHTS", Workout: "WORKOUT", Yoga: "YOGA",
    Rowing: "ROW", StairStepper: "STAIRS", Skiing: "SKI",
    Snowboard: "SNOWBOARD", Soccer: "SOCCER", Tennis: "TENNIS",
  };
  return map[type] ?? type.toUpperCase();
}

function formatDistance(meters: number): string {
  if (meters < 100) return "";
  if (meters < 1000) return `${Math.round(meters)}m`;
  return `${(meters / 1000).toFixed(1)}km`;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h${String(m).padStart(2, "0")}`;
  return `${m}min`;
}

function getWeekRange(today: Date): { start: Date; end: Date } {
  const start = new Date(today);
  const dow = today.getDay();
  start.setDate(today.getDate() - dow);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { start, end };
}

function weekLabel(start: Date, end: Date): string {
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric" }).toUpperCase();
  return `${fmt(start)} – ${fmt(end)}`;
}

function WeeklySummary({ activities }: { activities: StravaActivity[] }) {
  const today = new Date();
  const { start, end } = getWeekRange(today);
  const startKey = toDateKey(start.toISOString());
  const endKey = toDateKey(end.toISOString());

  const weekActivities = activities.filter((a) => {
    const k = toDateKey(a.startDate);
    return k >= startKey && k <= endKey;
  });

  if (weekActivities.length === 0) {
    return (
      <div className="mb-6">
        <p className="text-[9px] tracking-[0.25em] text-muted-foreground uppercase mb-1">this week</p>
        <p className="text-[11px] text-muted-foreground">{weekLabel(start, end)}</p>
        <p className="text-[11px] text-muted-foreground mt-1">no activities</p>
      </div>
    );
  }

  const byType = new Map<string, { count: number; distance: number; time: number }>();
  for (const a of weekActivities) {
    const label = typeLabel(a.type);
    const cur = byType.get(label) ?? { count: 0, distance: 0, time: 0 };
    byType.set(label, { count: cur.count + 1, distance: cur.distance + a.distance, time: cur.time + a.movingTime });
  }

  const totalDist = weekActivities.reduce((s, a) => s + a.distance, 0);
  const totalTime = weekActivities.reduce((s, a) => s + a.movingTime, 0);

  return (
    <div className="mb-6">
      <p className="text-[9px] tracking-[0.25em] text-muted-foreground uppercase mb-1">this week</p>
      <p className="text-[11px] text-muted-foreground mb-3">{weekLabel(start, end)}</p>
      <div className="space-y-2">
        {Array.from(byType.entries()).map(([label, s]) => (
          <div key={label} className="flex items-baseline gap-3">
            <span className="text-[11px] tracking-wider w-16 flex-shrink-0">{label}</span>
            <span className="text-[13px]">{s.count}×</span>
            {s.distance > 100 && <span className="text-[13px]">{formatDistance(s.distance)}</span>}
            <span className="text-[12px] text-muted-foreground">{formatDuration(s.time)}</span>
          </div>
        ))}
      </div>
      <div className="flex gap-4 mt-3 pt-3 border-t border-border/50">
        <span className="text-[11px] text-muted-foreground">{weekActivities.length} activities</span>
        {totalDist > 100 && <span className="text-[11px] text-muted-foreground">{formatDistance(totalDist)}</span>}
        <span className="text-[11px] text-muted-foreground">{formatDuration(totalTime)}</span>
      </div>
    </div>
  );
}

function ActivityDetail({ a }: { a: StravaActivity }) {
  const dist = formatDistance(a.distance);
  return (
    <div className="py-2.5 border-b border-border">
      <div className="flex items-center gap-2 mb-0.5">
        <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", typeColor(a.type))} />
        <span className="text-[10px] tracking-[0.2em] text-muted-foreground">{typeLabel(a.type)}</span>
      </div>
      <div className="flex items-baseline gap-3 pl-3.5">
        {dist && <span className="text-[14px]">{dist}</span>}
        <span className="text-[12px] text-muted-foreground">{formatDuration(a.movingTime)}</span>
        {a.elevationGain > 5 && (
          <span className="text-[12px] text-muted-foreground">↑{Math.round(a.elevationGain)}m</span>
        )}
        {a.averageHeartrate && (
          <span className="text-[12px] text-muted-foreground">{Math.round(a.averageHeartrate)}bpm</span>
        )}
      </div>
      {a.name && (
        <p className="text-[11px] text-muted-foreground pl-3.5 truncate">{a.name}</p>
      )}
    </div>
  );
}

export function WorkoutTab() {
  const { connected, activities, loading, error, init, loadMonth } = useStravaStore();
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  useEffect(() => { init(); }, [init]);
  useEffect(() => { loadMonth(viewYear, viewMonth); }, [viewYear, viewMonth, loadMonth]);

  const goMonth = (delta: number) => {
    const d = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
    setSelectedKey(null);
  };

  const byDate = new Map<string, StravaActivity[]>();
  for (const a of activities) {
    const k = toDateKey(a.startDate);
    if (!byDate.has(k)) byDate.set(k, []);
    byDate.get(k)!.push(a);
  }

  const firstDay = new Date(viewYear, viewMonth, 1);
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const startOffset = firstDay.getDay();
  const cells: (number | null)[] = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const todayKey = toDateKey(today.toISOString().replace("Z", ""));
  const selectedActivities = selectedKey ? (byDate.get(selectedKey) ?? []) : [];
  const monthLabel = new Date(viewYear, viewMonth, 1)
    .toLocaleDateString("en-US", { month: "long", year: "numeric" })
    .toUpperCase();

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="px-7 pt-10 pb-4" />

      <div className="flex-1 overflow-y-auto px-7 pb-8" style={{ scrollbarWidth: "none" }}>
        {!connected && !loading && (
          <div className="space-y-4 mt-4">
            <p className="text-[12px] text-muted-foreground">Connect Strava to see your workouts.</p>
            <a href={stravaAuthUrl()} className="inline-block px-5 py-2 bg-[#FC4C02] text-white text-[11px] tracking-wider rounded-full">
              Connect Strava
            </a>
          </div>
        )}

        {connected && (
          <>
            <WeeklySummary activities={activities} />

            <div className="flex items-center justify-between mb-4">
              <button onClick={() => goMonth(-1)} className="text-muted-foreground px-1 py-1 text-[13px]">‹</button>
              <span className="text-[11px] tracking-[0.2em]">{monthLabel}</span>
              <button
                onClick={() => goMonth(1)}
                className="text-muted-foreground px-1 py-1 text-[13px]"
                disabled={viewYear === today.getFullYear() && viewMonth === today.getMonth()}
              >›</button>
            </div>

            <div className="grid grid-cols-7 mb-1">
              {WEEKDAYS.map((d, i) => (
                <div key={i} className="text-center text-[10px] text-muted-foreground py-1">{d}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-y-1 mb-5">
              {cells.map((day, i) => {
                if (!day) return <div key={i} />;
                const key = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                const dayActivities = byDate.get(key) ?? [];
                const isToday = key === todayKey;
                const isSelected = key === selectedKey;
                return (
                  <button key={i} onClick={() => setSelectedKey(isSelected ? null : key)} className="flex flex-col items-center py-1 rounded-lg">
                    <span className={cn(
                      "text-[12px] w-7 h-7 flex items-center justify-center rounded-full transition-colors",
                      isSelected && "bg-foreground text-background",
                      isToday && !isSelected && "text-foreground font-medium",
                      !isToday && !isSelected && "text-foreground/70"
                    )}>
                      {day}
                    </span>
                    <div className="flex gap-0.5 h-1.5 items-center mt-0.5">
                      {dayActivities.slice(0, 3).map((a, j) => (
                        <span key={j} className={cn("w-1 h-1 rounded-full", typeColor(a.type))} />
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>

            {selectedKey && selectedActivities.length === 0 && (
              <p className="text-[11px] text-muted-foreground">no activities</p>
            )}
            {selectedActivities.map((a) => <ActivityDetail key={a.id} a={a} />)}

            {error && (
              <p className="text-[11px] text-muted-foreground mt-4">
                error: {error} — <button onClick={init} className="underline">retry</button>
              </p>
            )}
            {loading && <p className="text-[11px] text-muted-foreground tracking-widest mt-4">loading...</p>}
          </>
        )}
      </div>
    </div>
  );
}
