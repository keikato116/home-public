import { describe, it, expect, beforeEach } from "vitest";
import { useCalendarStore } from "./calendarStore";
import { CalendarEvent } from "@/types";

function ev(partial: Partial<CalendarEvent> & Pick<CalendarEvent, "id" | "start" | "end">): CalendarEvent {
  return { summary: partial.id, ...partial };
}

describe("eventsByDate", () => {
  beforeEach(() => {
    useCalendarStore.setState({ events: [] });
  });

  it("groups a Google all-day single-day event (exclusive end) only on its start date", () => {
    useCalendarStore.setState({
      events: [ev({ id: "a", start: { date: "2026-07-04" }, end: { date: "2026-07-05" } })],
    });
    const groups = useCalendarStore.getState().eventsByDate();
    expect(Object.keys(groups).sort()).toEqual(["2026-07-04"]);
  });

  it("groups a local all-day event (end == start) on its date", () => {
    useCalendarStore.setState({
      events: [ev({ id: "a", isLocal: true, start: { date: "2026-07-04" }, end: { date: "2026-07-04" } })],
    });
    const groups = useCalendarStore.getState().eventsByDate();
    expect(Object.keys(groups)).toEqual(["2026-07-04"]);
  });

  it("expands a Google multi-day all-day event across all covered dates (exclusive end)", () => {
    useCalendarStore.setState({
      events: [ev({ id: "a", start: { date: "2026-07-04" }, end: { date: "2026-07-07" } })],
    });
    const groups = useCalendarStore.getState().eventsByDate();
    expect(Object.keys(groups).sort()).toEqual(["2026-07-04", "2026-07-05", "2026-07-06"]);
  });

  it("groups timed events by JST date even when UTC date differs", () => {
    useCalendarStore.setState({
      events: [ev({ id: "a", start: { dateTime: "2026-07-04T23:00:00Z" }, end: { dateTime: "2026-07-04T23:30:00Z" } })],
    });
    const groups = useCalendarStore.getState().eventsByDate();
    // 23:00 UTC = 08:00 JST next day
    expect(Object.keys(groups)).toEqual(["2026-07-05"]);
  });

  it("groups timezone-less local timed events by their literal (JST device) date", () => {
    useCalendarStore.setState({
      events: [ev({ id: "a", isLocal: true, start: { dateTime: "2026-07-04T18:00:00" }, end: { dateTime: "2026-07-04T19:00:00" } })],
    });
    const groups = useCalendarStore.getState().eventsByDate();
    expect(Object.keys(groups)).toEqual(["2026-07-04"]);
  });

  it("adds timed multi-day events to every covered date", () => {
    useCalendarStore.setState({
      events: [ev({
        id: "concert",
        start: { dateTime: "2026-07-04T08:00:00+09:00" },
        end: { dateTime: "2026-07-05T20:00:00+09:00" },
      })],
    });
    const groups = useCalendarStore.getState().eventsByDate();
    expect(Object.keys(groups).sort()).toEqual(["2026-07-04", "2026-07-05"]);
    expect(groups["2026-07-04"][0].id).toBe("concert");
    expect(groups["2026-07-05"][0].id).toBe("concert");
  });
});
