"use client";

import { useEffect } from "react";
import { useCalendarStore } from "@/store/calendarStore";
import { useAuthStore } from "@/store/authStore";
import { CalendarEventRow } from "./CalendarEventRow";
import { RefreshCw } from "lucide-react";

export function CalendarTab() {
  const { householdId, accessToken, reAuthGoogle } = useAuthStore();
  const { load, eventsByDate, loading, error } = useCalendarStore();

  useEffect(() => {
    if (!householdId) return;
    load(householdId, accessToken);
  }, [householdId, accessToken, load]);

  const groups = eventsByDate();
  const dates = Object.keys(groups).sort();

  const formatGroupDate = (dateStr: string) => {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("en-US", { month: "long", day: "numeric", weekday: "short" });
  };

  return (
    <div className="flex flex-col h-full px-7 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <p className="text-[10px] tracking-widest text-muted-foreground uppercase">calendar</p>
          <h2 className="text-[22px] tracking-wide">calendar</h2>
        </div>
        <button
          onClick={() => householdId && load(householdId, accessToken)}
          className="text-muted-foreground hover:text-foreground transition-colors"
          aria-label="refresh"
        >
          <RefreshCw size={13} />
        </button>
      </div>

      {error && (
        <div className="text-[11px] text-muted-foreground border border-border rounded p-4 space-y-3">
          <p>{error}</p>
          {error.includes("再ログイン") && (
            <button
              onClick={reAuthGoogle}
              className="border border-border rounded px-3 py-2 text-[11px] tracking-wider hover:bg-muted transition-colors"
            >
              reconnect google
            </button>
          )}
        </div>
      )}

      {loading && <p className="text-[11px] text-muted-foreground">loading...</p>}

      {!loading && !error && dates.length === 0 && (
        <p className="text-[11px] text-muted-foreground">
          no events found. select calendar colors in settings.
        </p>
      )}

      <div className="flex-1 space-y-6 overflow-y-auto">
        {dates.map((date) => (
          <div key={date}>
            <p className="text-[10px] tracking-widest text-muted-foreground uppercase mb-2">
              {formatGroupDate(date)}
            </p>
            {groups[date].map((event) => (
              <CalendarEventRow key={event.id} event={event} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
