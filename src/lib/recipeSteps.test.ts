import { describe, it, expect } from "vitest";
import { stepLines, hostOf } from "./recipeSteps";

describe("stepLines", () => {
  it("1行が1手順。番号を振る", () => {
    expect(stepLines("切る\n\n焼く")).toEqual([
      { n: 1, text: "切る", heading: false },
      { n: 2, text: "焼く", heading: false },
    ]);
  });

  it("サイトの番号は外して振り直す", () => {
    expect(stepLines("1. 切る\n2）焼く\n③ 盛る\nSTEP4 食べる").map((s) => s.text)).toEqual(["切る", "焼く", "盛る", "食べる"]);
  });

  it("【見出し】は番号を付けず、番号も進めない", () => {
    expect(stepLines("【タネ】\nこねる\n【焼く】\n焼く")).toEqual([
      { n: null, text: "タネ", heading: true },
      { n: 1, text: "こねる", heading: false },
      { n: null, text: "焼く", heading: true },
      { n: 2, text: "焼く", heading: false },
    ]);
  });

  it("番号だけの行は消さない", () => {
    expect(stepLines("1.")[0].text).toBe("1.");
  });
});

describe("hostOf", () => {
  it("www を外す", () => {
    expect(hostOf("https://www.kurashiru.com/recipes/abc")).toBe("kurashiru.com");
  });
  it("URL でなければそのまま", () => {
    expect(hostOf("not a url")).toBe("not a url");
  });
});
