import { describe, it, expect } from "vitest";
import {
  toJSTDateStr, toJSTMinOfDay, toDateStr, isSameDay,
  getWeekDays, getMonthDays, isWeekendOrHoliday,
} from "./dates";

describe("toJSTDateStr", () => {
  it("converts UTC to JST date", () => {
    expect(toJSTDateStr("2026-07-04T23:00:00Z")).toBe("2026-07-05");
    expect(toJSTDateStr("2026-07-04T08:00:00Z")).toBe("2026-07-04");
  });
  it("handles explicit JST offsets", () => {
    expect(toJSTDateStr("2026-07-04T08:00:00+09:00")).toBe("2026-07-04");
    expect(toJSTDateStr("2026-07-05T00:30:00+09:00")).toBe("2026-07-05");
  });
});

describe("toJSTMinOfDay", () => {
  it("returns minutes since JST midnight", () => {
    expect(toJSTMinOfDay("2026-07-04T18:30:00+09:00")).toBe(18 * 60 + 30);
    expect(toJSTMinOfDay("2026-07-04T15:00:00Z")).toBe(0); // 00:00 JST next day
  });
});

describe("toDateStr", () => {
  it("uses local date components (never shifts across midnight)", () => {
    expect(toDateStr(new Date(2026, 6, 4))).toBe("2026-07-04");
    expect(toDateStr(new Date(2026, 0, 1))).toBe("2026-01-01");
  });
});

describe("isSameDay", () => {
  it("compares local dates", () => {
    expect(isSameDay(new Date(2026, 6, 4, 0, 0), new Date(2026, 6, 4, 23, 59))).toBe(true);
    expect(isSameDay(new Date(2026, 6, 4), new Date(2026, 6, 5))).toBe(false);
  });
});

describe("getWeekDays", () => {
  it("returns Sun-Sat of the containing week", () => {
    // 2026-06-12 is a Friday
    const days = getWeekDays(new Date(2026, 5, 12));
    expect(days).toHaveLength(7);
    expect(days[0].getDay()).toBe(0);
    expect(toDateStr(days[0])).toBe("2026-06-07");
    expect(toDateStr(days[6])).toBe("2026-06-13");
  });
});

describe("getMonthDays", () => {
  it("pads leading nulls to align the first weekday", () => {
    // June 2026 starts on a Monday (day 1)
    const cells = getMonthDays(2026, 5);
    expect(cells[0]).toBeNull();
    expect(cells[1]?.getDate()).toBe(1);
    expect(cells.filter(Boolean)).toHaveLength(30);
  });
});

describe("isWeekendOrHoliday", () => {
  it("detects weekends", () => {
    expect(isWeekendOrHoliday(new Date(2026, 5, 13))).toBe(true);  // Sat
    expect(isWeekendOrHoliday(new Date(2026, 5, 14))).toBe(true);  // Sun
    expect(isWeekendOrHoliday(new Date(2026, 5, 12))).toBe(false); // Fri
  });
  it("detects Japanese public holidays", () => {
    expect(isWeekendOrHoliday(new Date(2026, 0, 1))).toBe(true); // 元日
  });
});
