import { describe, it, expect } from "vitest";
import { fitWithin, STORAGE_MAX_EDGE, ANALYZE_MAX_EDGE } from "./imageResize";

describe("fitWithin", () => {
  it("縦長のスマホ写真（4032×3024 を縦に）を長辺 2048 に", () => {
    expect(fitWithin(3024, 4032, STORAGE_MAX_EDGE)).toEqual({ width: 1536, height: 2048 });
  });

  it("横長は横を合わせる", () => {
    expect(fitWithin(4032, 3024, ANALYZE_MAX_EDGE)).toEqual({ width: 1568, height: 1176 });
  });

  it("もともと小さければそのまま（拡大しない）", () => {
    expect(fitWithin(800, 600, STORAGE_MAX_EDGE)).toEqual({ width: 800, height: 600 });
  });

  it("ちょうど上限ならそのまま", () => {
    expect(fitWithin(2048, 1000, STORAGE_MAX_EDGE)).toEqual({ width: 2048, height: 1000 });
  });
});
