// レシピの作り方（recipes.steps）を画面に出すための整形。1行が1手順。

export interface StepLine {
  /** 手順の番号。見出し（【タネ】など）には付かない */
  n: number | null;
  text: string;
  heading: boolean;
}

// サイトが手順に付けている番号は外して、こちらで振り直す（二重に番号が出ないように）
const LEADING_NUMBER = /^(?:step\s*\d+[.:：)）]?|\d+[.．、:：)）]|[①-⑳]|[(（]\d+[)）])\s*/i;

export function stepLines(steps: string): StepLine[] {
  let n = 0;
  return steps
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      if (/^【.+】$/.test(line)) return { n: null, text: line.slice(1, -1), heading: true };
      n += 1;
      return { n, text: line.replace(LEADING_NUMBER, "").trim() || line, heading: false };
    });
}

/** "https://www.kurashiru.com/recipes/…" → "kurashiru.com" */
export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
