// 無料体験（App Store の導入オファー）の表示文言。
//
// 「1か月無料、その後は自動で月額に移る」は、App Store Connect でサブスク商品に
// 導入オファー（無料・1か月）を付けるだけで成立する。課金の切り替えは Apple が行い、
// こちらのコードは何もしない。ここでやるのは画面に正しく書くことだけ。
//
// 審査（Guideline 3.1.2）では、無料期間・その後の価格・自動で課金が始まることを
// 購入ボタンのそばに明示する必要がある。逆に、体験の対象外の人（同じ Apple ID で
// 一度使った人）に「無料」と出すと、押した瞬間に課金されるので誤認させることになる。
// だから対象かどうかが確定した人にだけ出す。

/** RevenueCat の PurchasesStoreProduct のうち、ここで使う部分 */
export interface TrialProduct {
  priceString: string;
  /** ISO 8601 の期間。"P1M" など */
  subscriptionPeriod: string | null;
  introPrice: {
    price: number;
    periodUnit: string;
    periodNumberOfUnits: number;
  } | null;
}

const UNIT_JA: Record<string, (n: number) => string> = {
  DAY: (n) => `${n}日間`,
  WEEK: (n) => `${n}週間`,
  MONTH: (n) => `${n}か月`,
  YEAR: (n) => `${n}年`,
};

/** "P1M" → "月"、"P1Y" → "年"。1単位でなければ "3か月" のように数を付ける。 */
export function billingPeriodLabel(iso: string | null): string {
  const m = iso?.match(/^P(\d+)([DWMY])$/);
  if (!m) return "";
  const n = Number(m[1]);
  const unit = m[2];
  if (n === 1) return { D: "日", W: "週", M: "月", Y: "年" }[unit] ?? "";
  return { D: `${n}日`, W: `${n}週間`, M: `${n}か月`, Y: `${n}年` }[unit] ?? "";
}

/** "¥300/月" */
export function priceLabel(product: TrialProduct): string {
  const per = billingPeriodLabel(product.subscriptionPeriod);
  return per ? `${product.priceString}/${per}` : product.priceString;
}

/**
 * 無料体験の文言。出すべきでなければ null。
 * @param eligible 体験の対象だと StoreKit が確定させたときだけ true
 */
export function freeTrialLabel(product: TrialProduct, eligible: boolean): string | null {
  const intro = product.introPrice;
  if (!eligible || !intro || intro.price !== 0) return null;
  const fmt = UNIT_JA[intro.periodUnit];
  if (!fmt || intro.periodNumberOfUnits < 1) return null;
  return `最初の${fmt(intro.periodNumberOfUnits)}無料`;
}
