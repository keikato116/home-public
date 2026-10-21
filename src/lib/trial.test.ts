import { describe, it, expect } from "vitest";
import { freeTrialLabel, priceLabel, billingPeriodLabel, type TrialProduct } from "./trial";

const monthly = (introPrice: TrialProduct["introPrice"]): TrialProduct => ({
  priceString: "¥300",
  subscriptionPeriod: "P1M",
  introPrice,
});
const oneMonthFree = { price: 0, periodUnit: "MONTH", periodNumberOfUnits: 1 };

describe("freeTrialLabel", () => {
  it("1か月無料", () => {
    expect(freeTrialLabel(monthly(oneMonthFree), true)).toBe("最初の1か月無料");
  });

  it("対象外の人には出さない（押した瞬間に課金されるので）", () => {
    expect(freeTrialLabel(monthly(oneMonthFree), false)).toBeNull();
  });

  it("導入オファーが無ければ出さない", () => {
    expect(freeTrialLabel(monthly(null), true)).toBeNull();
  });

  it("無料ではない割引は「無料」と書かない", () => {
    expect(freeTrialLabel(monthly({ price: 100, periodUnit: "MONTH", periodNumberOfUnits: 1 }), true)).toBeNull();
  });

  it("日・週の単位", () => {
    expect(freeTrialLabel(monthly({ price: 0, periodUnit: "DAY", periodNumberOfUnits: 7 }), true)).toBe("最初の7日間無料");
    expect(freeTrialLabel(monthly({ price: 0, periodUnit: "WEEK", periodNumberOfUnits: 2 }), true)).toBe("最初の2週間無料");
  });

  it("知らない単位なら出さない", () => {
    expect(freeTrialLabel(monthly({ price: 0, periodUnit: "UNKNOWN", periodNumberOfUnits: 1 }), true)).toBeNull();
  });
});

describe("priceLabel", () => {
  it("月額", () => {
    expect(priceLabel(monthly(null))).toBe("¥300/月");
  });

  it("年額・3か月", () => {
    expect(billingPeriodLabel("P1Y")).toBe("年");
    expect(billingPeriodLabel("P3M")).toBe("3か月");
  });

  it("期間が分からなければ価格だけ", () => {
    expect(priceLabel({ priceString: "¥300", subscriptionPeriod: null, introPrice: null })).toBe("¥300");
  });
});
