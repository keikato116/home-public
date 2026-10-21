import { describe, it, expect } from "vitest";
import { extractJsonLdRecipe, minutesOf, cleanText } from "./recipeJsonLd";

const page = (ld: unknown) =>
  `<html><head><script type="application/ld+json">${JSON.stringify(ld)}</script></head><body>…</body></html>`;

describe("extractJsonLdRecipe", () => {
  it("よくある形（HowToStep の配列）", () => {
    const r = extractJsonLdRecipe(page({
      "@context": "https://schema.org",
      "@type": "Recipe",
      name: "鶏の照り焼き",
      recipeYield: "2人分",
      totalTime: "PT25M",
      recipeCategory: "主菜",
      recipeIngredient: ["鶏もも肉 1枚", "しょうゆ 大さじ2", "みりん&nbsp;大さじ2"],
      recipeInstructions: [
        { "@type": "HowToStep", text: "鶏肉の皮目をフォークで刺す。" },
        { "@type": "HowToStep", text: "フライパンで<b>皮目から</b>焼く。" },
      ],
      image: "https://example.com/a.jpg",
    }));
    expect(r).toEqual({
      title: "鶏の照り焼き",
      ingredients: "鶏もも肉 1枚\nしょうゆ 大さじ2\nみりん 大さじ2",
      steps: "鶏肉の皮目をフォークで刺す。\nフライパンで皮目から焼く。",
      servings: 2,
      cook_time_min: 25,
      category: "main",
    });
  });

  it("@graph の中にある", () => {
    const r = extractJsonLdRecipe(page({
      "@context": "https://schema.org",
      "@graph": [
        { "@type": "WebPage", name: "ページ" },
        { "@type": ["Recipe"], name: "味噌汁", recipeIngredient: ["豆腐"], recipeInstructions: "だしを取る。\n味噌を溶く。" },
      ],
    }));
    expect(r?.title).toBe("味噌汁");
    expect(r?.steps).toBe("だしを取る。\n味噌を溶く。");
    expect(r?.category).toBe("soup");
  });

  it("見出しつきのまとまり（HowToSection）", () => {
    const r = extractJsonLdRecipe(page({
      "@type": "Recipe",
      name: "ハンバーグ",
      recipeIngredient: ["ひき肉 300g"],
      recipeInstructions: [
        { "@type": "HowToSection", name: "タネ", itemListElement: [{ "@type": "HowToStep", text: "こねる。" }] },
        { "@type": "HowToSection", name: "焼く", itemListElement: [{ "@type": "HowToStep", text: "両面を焼く。" }] },
      ],
    }));
    expect(r?.steps).toBe("【タネ】\nこねる。\n【焼く】\n両面を焼く。");
  });

  it("複数の script のうち Recipe のものを使う。壊れた JSON は飛ばす", () => {
    const html =
      `<script type="application/ld+json">{ broken</script>` +
      `<script type="application/ld+json">${JSON.stringify({ "@type": "Organization", name: "会社" })}</script>` +
      `<script type="application/ld+json">${JSON.stringify({ "@type": "Recipe", name: "卵焼き", recipeIngredient: ["卵 3個"] })}</script>`;
    expect(extractJsonLdRecipe(html)?.title).toBe("卵焼き");
  });

  it("材料も作り方も無ければ読めたことにしない", () => {
    expect(extractJsonLdRecipe(page({ "@type": "Recipe", name: "名前だけ" }))).toBeNull();
  });

  it("レシピの埋め込みが無いページ", () => {
    expect(extractJsonLdRecipe("<html><body>ブログ</body></html>")).toBeNull();
  });

  it("画像は返さない", () => {
    const r = extractJsonLdRecipe(page({ "@type": "Recipe", name: "x", recipeIngredient: ["a"], image: ["https://e/x.jpg"] }));
    expect(Object.keys(r!)).not.toContain("image");
    expect(Object.keys(r!)).not.toContain("thumbnail_url");
  });
});

describe("minutesOf", () => {
  it.each([["PT1H30M", 90], ["PT45M", 45], ["P0DT2H", 120], ["PT0M", null], ["30分", null]])("%s → %s", (v, m) => {
    expect(minutesOf(v)).toBe(m);
  });
});

describe("cleanText", () => {
  it("文字参照とタグを外す", () => {
    expect(cleanText("塩&amp;こしょう<br>少々 &#x3042;")).toBe("塩&こしょう\n少々 あ");
  });
});
