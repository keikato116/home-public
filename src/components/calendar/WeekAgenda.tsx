"use client";

import { CalendarEvent } from "@/types";
import { CalendarEventRow } from "./CalendarEventRow";
import { getJapaneseHolidayName } from "@/lib/japaneseHolidays";
import { toDateStr, isSameDay } from "@/lib/dates";

// Week agenda — shows all 7 days with their events inline
interface WeekAgendaProps {
  weekDays: Date[];
  eventsMap: Record<string, CalendarEvent[]>;
  currentUserId: string | undefined;
  today: Date;
  onDelete: (id: string) => void;
}

export function WeekAgenda({ weekDays, eventsMap, currentUserId, today, onDelete }: WeekAgendaProps) {
  return (
    <>
      {weekDays.map((day) => {
        const dayStr = toDateStr(day);
        const events = (eventsMap[dayStr] ?? []).filter(e => !e.isLocal);
        const isToday = isSameDay(day, today);
        return (
          <div key={dayStr} className="mb-2">
            <div className="flex items-center gap-2 mb-1">
              <span className={[
                "text-[10px] tracking-widest uppercase",
                isToday ? "text-foreground" : day.getDay() === 0 || getJapaneseHolidayName(day) ? "text-red-500" : "text-muted-foreground",
              ].join(" ")}>
                {day.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
              </span>
              {getJapaneseHolidayName(day) && (
                <span className="text-[9px] text-red-400">{getJapaneseHolidayName(day)}</span>
              )}
              {isToday && <span className="w-1 h-1 rounded-full bg-foreground" />}
            </div>
            {events.length === 0
              ? <p className="text-[10px] text-muted-foreground pl-0">—</p>
              : events.map(e => (
                <CalendarEventRow
                  key={e.id + (e.ownerId ?? "")}
                  event={e}
                  isOwn={e.ownerId === currentUserId}
                  onDelete={e.isLocal ? onDelete : undefined}
                />
              ))
            }
          </div>
        );
      })}
    </>
  );
}
