// レシピサイトが検索エンジン向けに埋め込んでいるレシピ情報（schema.org の Recipe、JSON-LD）を読む。
//
// クックパッド・クラシル・デリッシュキッチンなど大手の多くが入れている。これがあれば
// Claude を使わずに、材料と作り方を書いてあるとおりに書き写せる（費用ゼロで正確）。
// 無いサイトだけ、/api/parse-recipe が Haiku で読む。
//
// 画像は扱わない（保存しない）。元のページへは recipes.url から飛べる。

export interface JsonLdRecipe {
  title: string;
  ingredients: string | null;
  steps: string | null;
  servings: number | null;
  cook_time_min: number | null;
  category: string | null;
}

type Json = unknown;

function asArray<T>(v: T | T[] | undefined | null): T[] {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

function isRecipe(node: Json): node is Record<string, Json> {
  if (!node || typeof node !== "object") return false;
  const t = (node as Record<string, Json>)["@type"];
  return asArray(t as string | string[]).some((x) => typeof x === "string" && /(^|\/)Recipe$/i.test(x));
}

/** JSON-LD の中から Recipe を探す（配列、@graph、入れ子のどれでも） */
function findRecipe(node: Json, depth = 0): Record<string, Json> | null {
  if (depth > 6 || node == null || typeof node !== "object") return null;
  if (isRecipe(node)) return node;
  if (Array.isArray(node)) {
    for (const n of node) {
      const r = findRecipe(n, depth + 1);
      if (r) return r;
    }
    return null;
  }
  const obj = node as Record<string, Json>;
  for (const key of ["@graph", "mainEntity", "mainEntityOfPage", "itemListElement", "item"]) {
    const r = findRecipe(obj[key], depth + 1);
    if (r) return r;
  }
  return null;
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

/** HTML タグと文字参照を外し、空白を整える */
export function cleanText(s: string): string {
  return s
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m)
    .replace(/[ \t　]+/g, " ")
    .replace(/ *\n */g, "\n")
    .trim();
}

function str(v: Json): string | null {
  if (typeof v === "string") return cleanText(v) || null;
  if (typeof v === "number") return String(v);
  return null;
}

/** recipeInstructions は 文字列 / HowToStep の配列 / HowToSection（見出しつきのまとまり）のどれか */
function stepsOf(v: Json): string[] {
  if (v == null) return [];
  if (typeof v === "string") {
    return cleanText(v).split(/\n+/).map((s) => s.trim()).filter(Boolean);
  }
  if (Array.isArray(v)) return v.flatMap(stepsOf);
  if (typeof v === "object") {
    const o = v as Record<string, Json>;
    const type = asArray(o["@type"] as string | string[]).join(",");
    if (/HowToSection/i.test(type)) {
      const name = str(o.name);
      const inner = stepsOf(o.itemListElement);
      return name ? [`【${name}】`, ...inner] : inner;
    }
    const text = str(o.text) ?? str(o.name);
    return text ? [text] : [];
  }
  return [];
}

/** "4人分" / "2-3 servings" / 4 / ["4", "4人分"] → 4 */
function servingsOf(v: Json): number | null {
  for (const x of asArray(v as Json[])) {
    const m = String(x).match(/\d+/);
    if (m) {
      const n = Number(m[0]);
      if (n > 0 && n < 100) return n;
    }
  }
  return null;
}

/** ISO 8601 の期間（PT1H30M など）→ 分 */
export function minutesOf(v: Json): number | null {
  if (typeof v !== "string") return null;
  const m = v.match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/i);
  if (!m) return null;
  const total = Number(m[1] ?? 0) * 1440 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0) + (Number(m[4] ?? 0) >= 30 ? 1 : 0);
  return total > 0 ? total : null;
}

// アプリのカテゴリ（/api/parse-recipe の CATEGORIES）に、サイトの分類の言葉から寄せる
const CATEGORY_HINTS: [RegExp, string][] = [
  [/弁当|bento/i, "bento"],
  [/デザート|スイーツ|お菓子|ケーキ|dessert/i, "dessert"],
  [/スープ|汁|味噌汁|ポタージュ|soup/i, "soup"],
  [/パスタ|スパゲ|pasta/i, "pasta"],
  [/麺|うどん|そば|ラーメン|焼きそば|noodle/i, "noodles"],
  [/丼|ご飯|ごはん|炊き込み|チャーハン|リゾット|rice/i, "rice & bowl"],
  [/副菜|サラダ|和え|おひたし|side/i, "side"],
  [/主菜|メイン|main/i, "main"],
];

function categoryOf(...hints: Json[]): string | null {
  const text = hints.flatMap((h) => asArray(h as Json[])).map(String).join(" ");
  for (const [re, cat] of CATEGORY_HINTS) if (re.test(text)) return cat;
  return null;
}

/** ページの HTML から Recipe を1件取り出す。無ければ null。 */
export function extractJsonLdRecipe(html: string): JsonLdRecipe | null {
  const scripts = Array.from(html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi));
  for (const [, body] of scripts) {
    let data: Json;
    try {
      data = JSON.parse(body.trim());
    } catch {
      continue;
    }
    const r = findRecipe(data);
    if (!r) continue;

    const title = str(r.name);
    const ingredients = asArray((r.recipeIngredient ?? r.ingredients) as Json[])
      .map(str)
      .filter((s): s is string => !!s);
    const steps = stepsOf(r.recipeInstructions);
    // 料理名と、材料か作り方のどちらかが無ければ、読めたことにしない（Haiku に回す）
    if (!title || (ingredients.length === 0 && steps.length === 0)) continue;

    return {
      title,
      ingredients: ingredients.length ? ingredients.join("\n") : null,
      steps: steps.length ? steps.map((s) => s.replace(/\n+/g, " ")).join("\n") : null,
      servings: servingsOf(r.recipeYield),
      cook_time_min: minutesOf(r.totalTime) ?? minutesOf(r.cookTime),
      category: categoryOf(r.recipeCategory, r.keywords, title),
    };
  }
  return null;
}
