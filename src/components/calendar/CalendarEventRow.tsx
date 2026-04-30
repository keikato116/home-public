"use client";

import { CalendarEvent } from "@/types";
import { GOOGLE_COLOR_HEX } from "@/lib/calendar";
import { formatEventTime } from "@/lib/calendar";

interface Props {
  event: CalendarEvent;
}

export function CalendarEventRow({ event }: Props) {
  const color = event.colorId ? GOOGLE_COLOR_HEX[event.colorId] : undefined;
  const time = formatEventTime(event);

  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-border">
      {color && (
        <span
          className="mt-0.5 w-2 h-2 rounded-full flex-shrink-0"
          style={{ backgroundColor: color }}
        />
      )}
      <div className="flex-1 min-w-0">
        <p className="text-[12px] tracking-wide truncate">{event.summary}</p>
        {time !== "終日" && (
          <p className="text-[10px] text-muted-foreground mt-0.5">{time}</p>
        )}
      </div>
      {time === "終日" && (
        <span className="text-[10px] text-muted-foreground flex-shrink-0">終日</span>
      )}
    </div>
  );
}
