import { describe, it, expect } from "vitest";
import { getBillingPeriod, fmtYen, getSessionRatio } from "./lib";
import { SplitSession } from "@/types";

describe("getBillingPeriod", () => {
  it("uses the calendar month when closingDay is 0", () => {
    const p = getBillingPeriod(2026, 5, 0); // June 2026
    expect(p.from).toBe("2026-06-01");
    expect(p.to).toBe("2026-06-30");
    expect(p.rangeLabel).toBeNull();
  });

  it("ends on closingDay of the view month and starts the day after the previous closing", () => {
    const p = getBillingPeriod(2026, 4, 2); // May 2026, closes on the 2nd
    expect(p.from).toBe("2026-04-03");
    expect(p.to).toBe("2026-05-02");
    expect(p.rangeLabel).toBe("Apr 3 – May 2");
  });

  it("handles year boundaries", () => {
    const p = getBillingPeriod(2026, 0, 15); // Jan 2026, closes on the 15th
    expect(p.from).toBe("2025-12-16");
    expect(p.to).toBe("2026-01-15");
  });
});

describe("fmtYen", () => {
  it("rounds and formats with separator, dropping sign", () => {
    expect(fmtYen(1234.6)).toBe("¥1,235");
    expect(fmtYen(-500)).toBe("¥500");
    expect(fmtYen(0)).toBe("¥0");
  });
});

describe("getSessionRatio", () => {
  const base: SplitSession = {
    id: "1", household_id: "h", date: "2026-06-01", store: "s",
    card: "mine", items: [], shared_amount: 1000, created_at: "",
  };
  it("uses the her_ratio column when present", () => {
    expect(getSessionRatio({ ...base, her_ratio: 0.4 }, 0.5)).toBe(0.4);
  });
  it("falls back to the household default when her_ratio is null or missing", () => {
    expect(getSessionRatio(base, 0.5)).toBe(0.5);
    expect(getSessionRatio({ ...base, her_ratio: null }, 0.5)).toBe(0.5);
  });
});
