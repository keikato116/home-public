"use client";

import { CalendarEvent } from "@/types";
import { GOOGLE_COLOR_HEX } from "@/lib/calendar";

const HOUR_H = 40;
const START_H = 8;
const END_H = 24;
const HOURS = Array.from({ length: END_H - START_H + 1 }, (_, i) => i + START_H);
const TIME_W = 28;

function toMin(dt: string): number {
  const d = new Date(dt);
  return (d.getUTCHours() * 60 + d.getUTCMinutes() + 9 * 60) % 1440;
}

function toTop(min: number): number {
  return (Math.max(START_H * 60, min) - START_H * 60) / 60 * HOUR_H;
}

interface Props {
  events: CalendarEvent[];
  isToday: boolean;
  userId?: string;
  memberNameMap: Record<string, string>;
}

export function ScheduleTimeline({ events, isToday, userId, memberNameMap }: Props) {
  const allDay = events.filter(e => !e.start.dateTime);
  const timed = events.filter(e => !!e.start.dateTime);
  const myEvents = timed.filter(e => e.ownerId === userId);
  const partnerEvents = timed.filter(e => e.ownerId !== userId);

  const myName = myEvents[0]?.ownerName ?? (userId ? memberNameMap[userId] : "") ?? "me";
  const partnerEntry = Object.entries(memberNameMap).find(([id]) => id !== userId);
  const partnerName = partnerEvents[0]?.ownerName
    ?? allDay.find(e => e.ownerId !== userId)?.ownerName
    ?? (partnerEntry?.[1] ?? "");

  const nowMin = isToday
    ? (() => { const n = new Date(); return (n.getUTCHours() * 60 + n.getUTCMinutes() + 9 * 60) % 1440; })()
    : null;

  const renderCol = (evs: CalendarEvent[]) => evs.map(ev => {
    const startMin = toMin(ev.start.dateTime!);
    const rawEndMin = ev.end.dateTime ? toMin(ev.end.dateTime) : startMin + 60;
    const spansMidnight = rawEndMin <= startMin;
    const effectiveEndMin = spansMidnight ? END_H * 60 : rawEndMin;
    if (startMin >= END_H * 60) return null;
    if (!spansMidnight && effectiveEndMin <= START_H * 60) return null;
    const visibleStartMin = Math.max(startMin, START_H * 60);
    const cappedEndMin = Math.min(effectiveEndMin, END_H * 60);
    const durMin = Math.max(20, cappedEndMin - visibleStartMin);
    const top = toTop(startMin);
    const height = Math.max(HOUR_H / 2, (durMin / 60) * HOUR_H - 1);
    const hex = ev.colorId ? GOOGLE_COLOR_HEX[ev.colorId] : "#888888";
    return (
      <div
        key={ev.id}
        className="absolute inset-x-0.5 rounded px-1.5 py-1 overflow-hidden flex flex-col justify-start"
        style={{ top, height, backgroundColor: hex + "28", borderLeft: `2px solid ${hex}88` }}
      >
        <p className="text-[9px] leading-tight font-medium truncate w-full" style={{ color: hex }}>{ev.summary}</p>
      </div>
    );
  });

  const totalH = (END_H - START_H) * HOUR_H;

  return (
    <div>
      <p className="text-[9px] tracking-[0.3em] text-muted-foreground uppercase mb-1.5">schedule</p>
      {allDay.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {allDay.map(ev => (
            <span key={ev.id} className="text-[9px] border border-border rounded-full px-2 py-0.5 text-muted-foreground truncate max-w-full">
              {ev.summary}{ev.ownerName ? ` · ${ev.ownerName}` : ""}
            </span>
          ))}
        </div>
      )}
      <div className="flex">
        <div className="relative flex-shrink-0" style={{ width: TIME_W, height: totalH }}>
          {HOURS.map((h, i) => h % 2 === 0 && (
            <span key={h} className="absolute right-1.5 text-[9px] text-muted-foreground leading-none select-none" style={{ top: i * HOUR_H - 4 }}>
              {h === 24 ? "00" : String(h).padStart(2, "0")}
            </span>
          ))}
        </div>
        <div className="relative flex-1 border-l border-border/30" style={{ height: totalH }}>
          <span className="absolute top-1 left-1.5 text-[9px] text-foreground font-medium leading-none z-10 select-none">
            {myName[0]?.toUpperCase()}
          </span>
          {HOURS.map((_, i) => <div key={i} className="absolute inset-x-0 border-t border-border/20" style={{ top: i * HOUR_H }} />)}
          {nowMin !== null && nowMin >= START_H * 60 && (
            <div className="absolute inset-x-0 border-t border-red-400/70 z-10" style={{ top: toTop(nowMin) }} />
          )}
          {renderCol(myEvents)}
        </div>
        <div className="relative flex-1 border-l border-border/50" style={{ height: totalH }}>
          {partnerName && (
            <span className="absolute top-1 left-1.5 text-[9px] text-muted-foreground leading-none z-10 select-none">
              {partnerName[0]?.toUpperCase()}
            </span>
          )}
          {HOURS.map((_, i) => <div key={i} className="absolute inset-x-0 border-t border-border/20" style={{ top: i * HOUR_H }} />)}
          {nowMin !== null && nowMin >= START_H * 60 && (
            <div className="absolute inset-x-0 border-t border-red-400/70 z-10" style={{ top: toTop(nowMin) }} />
          )}
          {renderCol(partnerEvents)}
        </div>
      </div>
    </div>
  );
}
