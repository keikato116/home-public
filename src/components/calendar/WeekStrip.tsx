"use client";

import { CalendarEvent } from "@/types";
import { getJapaneseHolidayName } from "@/lib/japaneseHolidays";
import { toDateStr, isSameDay, DOW_LETTERS } from "@/lib/dates";
import { eventColor } from "./lib";

// Week strip — shows colored event bars per day (no text, columns too narrow)
interface WeekStripProps {
  weekDays: Date[];
  selectedDate: Date;
  today: Date;
  eventsMap: Record<string, CalendarEvent[]>;
  onSelect: (d: Date) => void;
}

export function WeekStrip({ weekDays, selectedDate, today, eventsMap, onSelect }: WeekStripProps) {
  return (
    <div className="flex border-b border-border px-4 pb-3">
      {weekDays.map((d, i) => {
        const isSelected = isSameDay(d, selectedDate);
        const isToday = isSameDay(d, today);
        const holiday = getJapaneseHolidayName(d);
        const isRed = d.getDay() === 0 || !!holiday;
        const dayEvents = eventsMap[toDateStr(d)] ?? [];
        return (
          <button key={i} className="flex-1 flex flex-col items-center gap-1" onClick={() => onSelect(d)}>
            <span className="text-[9px] text-muted-foreground tracking-wide">{DOW_LETTERS[d.getDay()]}</span>
            <span className={[
              "w-7 h-7 rounded-full flex items-center justify-center text-[12px]",
              isSelected ? "bg-foreground text-background"
                : isToday ? "border border-foreground text-foreground"
                : isRed ? "text-red-500"
                : "text-foreground",
            ].join(" ")}>
              {d.getDate()}
            </span>
            <div className="flex flex-col gap-px w-full px-0.5 mt-0.5">
              {dayEvents.slice(0, 3).map((e) => (
                <div key={e.id + (e.ownerId ?? "")} className="w-full h-1 rounded-sm"
                  style={{ backgroundColor: eventColor(e) }} />
              ))}
              {dayEvents.length > 3 && <div className="w-full h-1 rounded-sm bg-muted-foreground opacity-40" />}
            </div>
          </button>
        );
      })}
    </div>
  );
}
