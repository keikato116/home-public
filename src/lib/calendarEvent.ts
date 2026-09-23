import type { CalendarEvent } from "@/types";

// Google カレンダーの予定は **タイトルが無いことがある。**
//
// タイトルを空のまま保存された予定について、Calendar API は `summary` を
// 空文字で返すのではなく、**キーごと省く**。CalendarEvent 型は
// `summary: string` と宣言しているので、型は「必ずある」と言い続け、
// 型検査はこのずれを見つけられない。
//
// 結果、`ev.summary.replace(...)` が undefined で落ち、
// **予定1件のせいでアプリ全体が真っ白になる**（実際にそうなった）。
//
// 直し方は、読む側ごとに `?.` を撒くのではなく、**入ってくる境界で埋める**こと。
// 境界は2つあり、両方通す必要がある:
//   1. Google から取得したとき（自分の分も相手の分も lib/server/google.ts 経由）
//   2. localStorage のキャッシュから読み戻したとき
//      — JSON.stringify は undefined のキーを落とすので、キャッシュにも
//        summary の無い予定がそのまま残る。しかもキャッシュは取得を待たずに
//        描画されるので、こちらを直さないと開いた瞬間に落ちる。

/** タイトルが無い予定の表示名。Google カレンダー自身の表記に合わせてある。 */
export const UNTITLED_EVENT = "(タイトルなし)";

/** summary が必ず文字列である状態に整える。 */
export function withSummary<T extends object>(event: T): T & { summary: string } {
  const summary = (event as { summary?: string }).summary;
  return { ...event, summary: summary ?? UNTITLED_EVENT };
}

/** 配列版。境界ではこちらを使う。 */
export function withSummaries(events: CalendarEvent[]): CalendarEvent[] {
  return events.map(withSummary);
}
