"use client";

import { CalendarEvent } from "@/types";
import { GOOGLE_COLOR_HEX, formatEventTime } from "@/lib/calendar";

interface Props {
  event: CalendarEvent;
  isOwn: boolean;
}

export function CalendarEventRow({ event, isOwn }: Props) {
  const color = event.colorId ? GOOGLE_COLOR_HEX[event.colorId] : undefined;
  const time = formatEventTime(event);
  const initial = event.ownerName ? event.ownerName[0].toUpperCase() : null;

  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-border">
      {color && (
        <span
          className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: color }}
        />
      )}
      <div className="flex-1 min-w-0">
        <p className="text-[12px] tracking-wide truncate">{event.summary}</p>
        {time && time !== "終日" && (
          <p className="text-[10px] text-muted-foreground mt-0.5">{time}</p>
        )}
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0 mt-0.5">
        {time === "終日" && (
          <span className="text-[10px] text-muted-foreground">all day</span>
        )}
        {initial && (
          <span
            className={[
              "w-4 h-4 rounded-full flex items-center justify-center text-[8px]",
              isOwn
                ? "bg-foreground text-background"
                : "border border-muted-foreground text-muted-foreground",
            ].join(" ")}
          >
            {initial}
          </span>
        )}
      </div>
    </div>
  );
}
