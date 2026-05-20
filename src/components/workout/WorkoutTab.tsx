"use client";

import { useEffect, useState } from "react";
import { useStravaStore, StravaActivity } from "@/store/stravaStore";
import { cn } from "@/lib/utils";

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

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

function toDateKey(iso: string) {
  return iso.slice(0, 10);
}

function typeColor(type: string): string {
  const map: Record<string, string> = {
    Run: "bg-orange-400",
    TrailRun: "bg-orange-500",
    Ride: "bg-blue-400",
    VirtualRide: "bg-blue-300",
    EBikeRide: "bg-blue-300",
    Walk: "bg-green-400",
    Hike: "bg-green-500",
    Swim: "bg-cyan-400",
    WeightTraining: "bg-purple-400",
    Workout: "bg-purple-300",
    Yoga: "bg-pink-300",
    Rowing: "bg-teal-400",
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
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
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
  const { connected, athleteName, activities, loading, init, loadMonth } = useStravaStore();
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  useEffect(() => {
    init();
  }, [init]);

  useEffect(() => {
    loadMonth(viewYear, viewMonth);
  }, [viewYear, viewMonth, loadMonth]);

  const goMonth = (delta: number) => {
    const d = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
    setSelectedKey(null);
  };

  // Group activities by date key
  const byDate = new Map<string, StravaActivity[]>();
  for (const a of activities) {
    const k = toDateKey(a.startDate);
    if (!byDate.has(k)) byDate.set(k, []);
    byDate.get(k)!.push(a);
  }

  // Build calendar grid
  const firstDay = new Date(viewYear, viewMonth, 1);
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const startOffset = (firstDay.getDay() + 6) % 7; // Mon=0
  const cells: (number | null)[] = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const selectedActivities = selectedKey ? (byDate.get(selectedKey) ?? []) : [];

  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  }).toUpperCase();

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="px-7 pt-10 pb-4">
        <p className="text-[10px] tracking-[0.25em] text-muted-foreground uppercase mb-0.5">activity</p>
        <div className="flex items-baseline justify-between">
          <h1 className="text-[30px] font-light tracking-wide">WORKOUT</h1>
          {athleteName && (
            <p className="text-[11px] text-muted-foreground tracking-wide">{athleteName}</p>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-7 pb-8" style={{ scrollbarWidth: "none" }}>
        {!connected && !loading && (
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

        {connected && (
          <>
            {/* Month navigation */}
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={() => goMonth(-1)}
                className="text-muted-foreground px-1 py-1 text-[13px]"
              >
                ‹
              </button>
              <span className="text-[11px] tracking-[0.2em]">{monthLabel}</span>
              <button
                onClick={() => goMonth(1)}
                className="text-muted-foreground px-1 py-1 text-[13px]"
                disabled={viewYear === today.getFullYear() && viewMonth === today.getMonth()}
              >
                ›
              </button>
            </div>

            {/* Weekday labels */}
            <div className="grid grid-cols-7 mb-1">
              {WEEKDAYS.map((d, i) => (
                <div key={i} className="text-center text-[10px] text-muted-foreground py-1">
                  {d}
                </div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-y-1 mb-5">
              {cells.map((day, i) => {
                if (!day) return <div key={i} />;
                const key = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                const dayActivities = byDate.get(key) ?? [];
                const isToday = key === todayKey;
                const isSelected = key === selectedKey;
                const hasActivity = dayActivities.length > 0;

                return (
                  <button
                    key={i}
                    onClick={() => setSelectedKey(isSelected ? null : key)}
                    className="flex flex-col items-center py-1 rounded-lg"
                  >
                    <span
                      className={cn(
                        "text-[12px] w-7 h-7 flex items-center justify-center rounded-full transition-colors",
                        isSelected && "bg-foreground text-background",
                        isToday && !isSelected && "text-foreground font-medium",
                        !isToday && !isSelected && "text-foreground/70"
                      )}
                    >
                      {day}
                    </span>
                    <div className="flex gap-0.5 h-1.5 items-center mt-0.5">
                      {hasActivity && dayActivities.slice(0, 3).map((a, j) => (
                        <span key={j} className={cn("w-1 h-1 rounded-full", typeColor(a.type))} />
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Selected day activities */}
            {selectedKey && selectedActivities.length === 0 && (
              <p className="text-[11px] text-muted-foreground">no activities</p>
            )}
            {selectedActivities.map((a) => (
              <ActivityDetail key={a.id} a={a} />
            ))}

            {loading && (
              <p className="text-[11px] text-muted-foreground tracking-widest mt-4">loading...</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
