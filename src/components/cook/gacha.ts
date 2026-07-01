import { Recipe } from "@/types";
import { getJSON, setJSON } from "@/lib/storage";
import { LS_GACHA_HISTORY } from "@/lib/constants";

export type GachaResult =
  | { type: "combo"; main: Recipe; side: Recipe }
  | { type: "single"; recipe: Recipe };

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

const GACHA_HISTORY_MAX = 8;

function getGachaHistory(): string[] {
  return getJSON<string[]>(LS_GACHA_HISTORY, []);
}

function recordGachaHistory(ids: string[]) {
  setJSON(LS_GACHA_HISTORY, [...ids, ...getGachaHistory()].slice(0, GACHA_HISTORY_MAX));
}

// Excludes recently shown recipes; falls back to the full pool when exhausted
function freshPool<T extends { id: string }>(pool: T[], history: string[]): T[] {
  const fresh = pool.filter(r => !history.includes(r.id));
  return fresh.length > 0 ? fresh : pool;
}

export function rollGacha(recipes: Recipe[]): GachaResult | null {
  const by = (cat: string) => recipes.filter(r => r.category === cat);
  const mains = by("main");
  const sides = by("side");
  const pastas = by("pasta");
  const noodles = by("noodles");
  const bowls = by("rice & bowl");

  // Weight each dinner type by how many "main dish" options it holds, so a
  // category with 1 recipe isn't as likely as one with 20. combo counts by the
  // number of mains (each pairs with a side). This makes every main dish across
  // all categories roughly equally likely, instead of every category equally likely.
  const options: Array<{ type: "combo" | "pasta" | "noodles" | "bowl"; weight: number }> = [];
  if (mains.length > 0 && sides.length > 0) options.push({ type: "combo", weight: mains.length });
  if (pastas.length > 0) options.push({ type: "pasta", weight: pastas.length });
  if (noodles.length > 0) options.push({ type: "noodles", weight: noodles.length });
  if (bowls.length > 0) options.push({ type: "bowl", weight: bowls.length });

  if (options.length === 0) return null;
  const history = getGachaHistory();

  const totalWeight = options.reduce((sum, o) => sum + o.weight, 0);
  let roll = Math.random() * totalWeight;
  let type = options[options.length - 1].type;
  for (const o of options) {
    if (roll < o.weight) { type = o.type; break; }
    roll -= o.weight;
  }

  switch (type) {
    case "combo": {
      const main = pick(freshPool(mains, history));
      const side = pick(freshPool(sides, history));
      recordGachaHistory([main.id, side.id]);
      return { type: "combo", main, side };
    }
    case "pasta": {
      const r = pick(freshPool(pastas, history));
      recordGachaHistory([r.id]);
      return { type: "single", recipe: r };
    }
    case "noodles": {
      const r = pick(freshPool(noodles, history));
      recordGachaHistory([r.id]);
      return { type: "single", recipe: r };
    }
    default: {
      const r = pick(freshPool(bowls, history));
      recordGachaHistory([r.id]);
      return { type: "single", recipe: r };
    }
  }
}
