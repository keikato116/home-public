import { describe, it, expect } from "vitest";
import { shouldExitAfterLapse } from "./lapseExit";

describe("shouldExitAfterLapse", () => {
  it("切れた人に権利が無く、相手が課金中なら抜ける", () => {
    expect(shouldExitAfterLapse(null, ["subscription"])).toBe(true);
  });

  it("相手が運営の付与で使っていても抜ける", () => {
    expect(shouldExitAfterLapse(null, ["grant"])).toBe(true);
  });

  it("相手も権利を持っていなければ抜けない（無料で使っているペアを巻き込まない）", () => {
    expect(shouldExitAfterLapse(null, [null])).toBe(false);
  });

  it("切れた人に付与が残っていれば、切れていないので抜けない", () => {
    expect(shouldExitAfterLapse("grant", ["subscription"])).toBe(false);
  });

  it("1人世帯では何もしない", () => {
    expect(shouldExitAfterLapse(null, [])).toBe(false);
  });
});
