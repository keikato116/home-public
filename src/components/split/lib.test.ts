import { describe, it, expect } from "vitest";
import { getBillingPeriod, fmtYen, getSessionRatio, computeSettlement } from "./lib";
import { SplitSession, SplitSubscription, SplitUtility } from "@/types";

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

const receipt = (card: "mine" | "family", amount: number, her_ratio: number | null = null) =>
  ({ id: Math.random().toString(), household_id: "h", date: "2026-11-01", store: "x", card, shared_amount: amount, her_ratio, items: [] }) as unknown as SplitSession;
const sub = (card: "mine" | "family", amount: number) =>
  ({ id: Math.random().toString(), household_id: "h", name: "s", amount, card, active: true, created_at: "" }) as SplitSubscription;
const util = (id: string, card: "mine" | "family") =>
  ({ id, household_id: "h", name: id, card, created_at: "" }) as SplitUtility;

describe("computeSettlement", () => {
  it("引き継ぎ資料の検算例（50:50）: her owes ¥5,606", () => {
    const r = computeSettlement({
      sessions: [receipt("mine", 1959), receipt("mine", 9428), receipt("family", 6116)],
      subscriptions: [sub("mine", 5940)],
      utilities: [],
      utilityAmounts: {},
      splitRatio: 0.5,
      herCardBill: 0,
    });
    expect(r.himSplits).toBe(8663.5);
    expect(r.herSplits).toBe(3058);
    expect(Math.round(r.herOwes)).toBe(5606);
  });

  it("固定費はその月に入力された分だけ。未入力は 0", () => {
    const r = computeSettlement({
      sessions: [],
      subscriptions: [],
      utilities: [util("elec", "mine"), util("gas", "family"), util("water", "mine")],
      utilityAmounts: { elec: 8000, gas: 4000 },
      splitRatio: 0.5,
      herCardBill: 0,
    });
    expect(r.himSplits).toBe(4000);
    expect(r.herSplits).toBe(2000);
    expect(r.herOwes).toBe(2000);
  });

  it("レシートごとの割合を優先し、無い古いデータは全体の割合", () => {
    const r = computeSettlement({
      sessions: [receipt("mine", 1000, 1), receipt("mine", 1000, null)],
      subscriptions: [],
      utilities: [],
      utilityAmounts: {},
      splitRatio: 0.3,
      herCardBill: 0,
    });
    expect(r.himSplits).toBe(1300);
  });

  it("her のカード請求は全額が her owes に入る。マイナスなら him owes", () => {
    const r = computeSettlement({
      sessions: [receipt("family", 10000)],
      subscriptions: [],
      utilities: [],
      utilityAmounts: {},
      splitRatio: 0.5,
      herCardBill: 2000,
    });
    expect(r.herOwes).toBe(-3000);
    expect(r.himSplits + r.herCardBill - r.herSplits).toBe(r.herOwes);
  });
});
