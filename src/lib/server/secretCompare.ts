import { createHash, timingSafeEqual } from "node:crypto";

/**
 * 合言葉が一致するかを、かかる時間で中身が分からないように比べる。
 * `!==` は最初に違う文字で止まるので、応答時間の差から1文字ずつ当てられうる。
 * 長さの違いも漏らさないよう、両方をハッシュにそろえてから比べる。
 */
export function secretsMatch(given: string | null | undefined, expected: string): boolean {
  if (typeof given !== "string") return false;
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}
