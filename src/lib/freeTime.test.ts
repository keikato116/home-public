import { describe, it, expect } from "vitest";
import { hasEventInWindow, bothHaveAllDayEvent, hasAllDayBlock } from "./freeTime";
import { CalendarEvent } from "@/types";

function timed(id: string, start: string, end?: string, ownerId?: string): CalendarEvent {
  return { id, summary: id, start: { dateTime: start }, end: end ? { dateTime: end } : {}, ownerId };
}

function allDay(id: string, date: string, ownerId?: string): CalendarEvent {
  return { id, summary: id, start: { date }, end: { date }, ownerId };
}

describe("hasEventInWindow (18-21 dinner window)", () => {
  it("detects an event inside the window", () => {
    expect(hasEventInWindow([timed("a", "2026-07-04T19:00:00+09:00", "2026-07-04T20:00:00+09:00")], 18, 21)).toBe(true);
  });

  it("ignores events fully before or after the window", () => {
    expect(hasEventInWindow([timed("a", "2026-07-04T09:00:00+09:00", "2026-07-04T10:00:00+09:00")], 18, 21)).toBe(false);
    expect(hasEventInWindow([timed("a", "2026-07-04T21:30:00+09:00", "2026-07-04T22:00:00+09:00")], 18, 21)).toBe(false);
  });

  it("treats multi-day events as covering the rest of the start day", () => {
    // overnight shift starting 09:00, ending next day
    expect(hasEventInWindow([timed("a", "2026-07-04T09:00:00+09:00", "2026-07-05T09:00:00+09:00")], 18, 21)).toBe(true);
  });

  it("treats events spanning midnight (same-date endMin < startMin) as covering the evening", () => {
    expect(hasEventInWindow([timed("a", "2026-07-04T20:00:00+09:00", "2026-07-04T01:00:00+09:00")], 18, 21)).toBe(true);
  });

  it("ignores all-day events", () => {
    expect(hasEventInWindow([allDay("a", "2026-07-04")], 18, 21)).toBe(false);
  });
});

describe("bothHaveAllDayEvent", () => {
  it("requires all-day events from two distinct owners", () => {
    expect(bothHaveAllDayEvent([allDay("a", "2026-07-04", "u1"), allDay("b", "2026-07-04", "u2")])).toBe(true);
    expect(bothHaveAllDayEvent([allDay("a", "2026-07-04", "u1"), allDay("b", "2026-07-04", "u1")])).toBe(false);
    expect(bothHaveAllDayEvent([])).toBe(false);
  });
});

describe("hasAllDayBlock", () => {
  it("blocks on all-day events on regular days", () => {
    expect(hasAllDayBlock(new Date(2026, 6, 4), [allDay("当直", "2026-07-04")])).toBe(true);
  });
  it("does not block on public holidays", () => {
    expect(hasAllDayBlock(new Date(2026, 0, 1), [allDay("休み", "2026-01-01")])).toBe(false);
  });
  it("does not block without all-day events", () => {
    expect(hasAllDayBlock(new Date(2026, 6, 4), [timed("a", "2026-07-04T10:00:00+09:00")])).toBe(false);
  });
});
