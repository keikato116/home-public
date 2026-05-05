"use client";

import { useState } from "react";
import { useCalendarStore } from "@/store/calendarStore";
import { useAuthStore } from "@/store/authStore";
import { GOOGLE_COLOR_MAP, GOOGLE_COLOR_HEX } from "@/lib/calendar";
import { toISODate } from "@/lib/utils";

export function CalendarSettings() {
  const { householdId, accessToken } = useAuthStore();
  const { settings, updateSettings, load } = useCalendarStore();

  const [selectedColors, setSelectedColors] = useState<string[]>(settings?.selected_colors ?? []);
  const [startDate, setStartDate] = useState(settings?.start_date ?? toISODate(new Date()));
  const [saving, setSaving] = useState(false);

  const toggleColor = (colorId: string) => {
    setSelectedColors((prev) =>
      prev.includes(colorId) ? prev.filter((c) => c !== colorId) : [...prev, colorId]
    );
  };

  const save = async () => {
    if (!householdId) return;
    setSaving(true);
    try {
      await Promise.race([
        updateSettings(householdId, { selected_colors: selectedColors, start_date: startDate }),
        new Promise<void>((_, reject) => setTimeout(() => reject(new Error("timeout")), 8000)),
      ]);
      load(householdId, accessToken);
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-[10px] tracking-widest text-muted-foreground uppercase">calendar</p>

      <div>
        <p className="text-[11px] text-muted-foreground mb-3">show events with these colors</p>
        <div className="grid grid-cols-3 gap-2">
          {Object.entries(GOOGLE_COLOR_MAP).map(([id, name]) => (
            <label key={id} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedColors.includes(id)}
                onChange={() => toggleColor(id)}
                className="w-3 h-3"
              />
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: GOOGLE_COLOR_HEX[id] }}
              />
              <span className="text-[10px] tracking-wide truncate">{name}</span>
            </label>
          ))}
        </div>
        <label className="flex items-center gap-2 cursor-pointer mt-2">
          <input
            type="checkbox"
            checked={selectedColors.includes("default")}
            onChange={() => toggleColor("default")}
            className="w-3 h-3"
          />
          <span className="w-2.5 h-2.5 rounded-full bg-muted-foreground flex-shrink-0" />
          <span className="text-[10px] tracking-wide">default</span>
        </label>
      </div>

      <div>
        <p className="text-[11px] text-muted-foreground mb-2">show events from</p>
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="bg-transparent border-b border-border pb-1 text-[12px] focus:outline-none focus:border-foreground/40"
        />
      </div>

      <button
        onClick={save}
        disabled={saving}
        className="text-[11px] tracking-wider bg-foreground text-background rounded px-4 py-2 disabled:opacity-40"
      >
        {saving ? "saving..." : "save"}
      </button>
    </div>
  );
}
