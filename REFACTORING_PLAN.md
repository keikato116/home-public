# リファクタリング計画

> **完了 (2026-06-12)**: フェーズ0–7 すべて完了。DB migration 実行済み
> （highlight_* 残り0件、her_ratio 5件移行を確認）。レガシー対応コードも削除済み。

対象: 全コードベース（8,688行 / 70ファイル）
方針: 動作を変えずに段階的に整理する。各フェーズは独立してコミット・デプロイ可能で、壊れたらそのフェーズだけ巻き戻せる。

---

## 現状の問題サマリー

調査で判明した主な無駄:

| 問題 | 規模 |
|---|---|
| JST日付変換ヘルパーの重複実装 | 5ファイルに3方式で散在 |
| `toDateStr` / `isSameDay` 等の日付ヘルパー重複 | 6ファイル |
| 巨大コンポーネント | SplitTab 756行 / CookTab 641行 / CalendarTab 617行 |
| API route の重複 | calendar と partner-calendar が約90%同一 |
| store ごとにバラバラなパターン | リトライ・楽観更新・エラー処理が10 storeで不統一 |
| realtime購読の重複 | shoppingStore / diaryStore で同一実装 |
| マジックストリング | localStorage キー、テーブル名、OAuth スコープ、本番URL が直書き |
| レガシー型 | `highlight_dinner` / `highlight_lunch` の互換コードが残存 |
| デッドコード | `getEventDate`, `formatEventTime` (lib/calendar.ts) など |
| テスト | 0件 |

---

## フェーズ0: 安全網の構築（リファクタ前の準備）

リファクタは「壊していないこと」を確認できないと進められない。最初にこれだけ整える。

1. **Vitest 導入**（軽量・Next.js と相性良）
   - `npm i -D vitest @testing-library/react`
   - `npm run test` スクリプト追加
2. **純粋ロジックの現状固定テストを書く**（リファクタ対象の挙動をテストで固定してから動かす）
   - `eventsByDate()` — 全日/時刻あり/日跨ぎ/ローカルイベントの展開
   - JST変換系（`toJSTDateStr`, `toJSTMinOfDay`）— UTC→JST 日付跨ぎの境界ケース
   - `isHighlightPlan` — 新形式・レガシー形式両方
   - `getBillingPeriod` / `getCurrentPeriod`（SplitTab）— 締め日ロジック
   - `rollGacha` — 履歴除外とフォールバック
3. **`npm run build` と `npx tsc --noEmit` が通ることを確認**（以後、各フェーズの完了条件）

完了条件: テストが全部緑、build成功。
リスク: なし（プロダクションコード無変更）。

---

## フェーズ1: 共通ユーティリティへの統合

最も重複が多く、最もリスクが低い層から。**ロジックは一切変えず、定義場所だけ移す。**

### 1-1. `src/lib/dates.ts` を新設

以下を1箇所に集約（テストはフェーズ0で作成済み）:

- `toJSTDateStr(dt: string): string` — CookTab / CalendarTab / ScheduleTimeline(`toJSTDate`) / calendarStore の4実装を統合
- `toJSTMinOfDay(dt: string): number` — CookTab / CalendarTab / ScheduleTimeline(`toMin`) の3実装を統合
- `getJSTToday(): Date` — HomeTab から移動
- `toDateStr(d: Date): string` — CookTab / CalendarTab / SplitTab の3実装を統合（`lib/utils.ts` の `toISODate` と同一なら片方に寄せて re-export）
- `isSameDay(a, b)` — CookTab / CalendarTab / HomeTab の3実装を統合
- `getWeekDays`, `getMonthDays`, `isWeekendOrHoliday` — CalendarTab から移動
- `MONTH_NAMES`, `MON_SHORT`, `DOW_LETTERS` 定数

### 1-2. `src/lib/constants.ts` を新設

- localStorage キー: `google_access_token`, `cached_user`, `gacha_history`, `cal_cache_` など全部
- OAuth スコープ URL（authStore に3回直書き）
- `RECIPE_CATEGORIES`（recipeStore と parse-recipe route で重複）

### 1-3. `src/lib/storage.ts` を新設

- `getJSON<T>(key, fallback)` / `setJSON(key, value)` — try/catch 込みの localStorage ラッパー
- gacha履歴・calendarキャッシュ・authキャッシュの直接呼び出しを置き換え

### 1-4. デッドコード削除

- `lib/calendar.ts` の `getEventDate`, `formatEventTime`（未使用）

完了条件: 重複定義が0件（grep で確認）、tsc / build / テスト緑。
リスク: 低。import の付け替えのみ。

---

## フェーズ2: store パターンの統一

10個の Zustand store の不統一を解消する。**1 store ずつコミット。**

### 2-1. `src/lib/supabase/helpers.ts` を新設

- `withSessionRetry` を mealPlanStore からここへ昇格。失敗時に `refreshSession()` して1回だけ再試行する共通ヘルパー
- 全 store の Supabase mutation をこれ経由に統一（SplitTab で「再起動しないと入力できない」問題が起きたのはこの仕組みがなかったため。同じ潜在バグが他 store にもある）

### 2-2. load パターンの統一

全 store の `load` を共通形に:

```
set({ loading: true });
try { ...fetch...; set({ data, loading: false }); }
catch { set({ loading: false, error: ... }); }
```

- 現状 splitStore 以外にも try/catch なしで loading が固まり得る store がある（todoStore, recipeStore, settingsStore など）→ 全部に適用
- `loading` / `syncing` / `error` のフィールド名と意味を全 store で揃える

### 2-3. realtime 購読の共通化

- shoppingStore / diaryStore の同一 channel 購読コードを `subscribeTable(table, householdId, onChange)` ヘルパーに抽出

### 2-4. 楽観更新パターンの統一

- 「temp ID で即時反映 → サーバ確定で置換 → 失敗で除去」パターン（calendarStore.addLocalEvent が一番きれい）をヘルパー化し、mealPlanStore / splitStore / shoppingStore に適用

完了条件: 全 store が同じ load/mutation 形式。手動で各タブの表示・追加・削除を確認。
リスク: 中。store は全タブの基盤なので1 storeごとにコミットして検証。

---

## フェーズ3: API routes の重複排除

### 3-1. Google Calendar fetch の共通化

- `/api/calendar/route.ts` と `/api/partner-calendar/route.ts` の約90%同一なロジックを `src/lib/server/googleCalendar.ts` に抽出
  - `fetchEventsFromAllCalendars(token, colors, from)` 1関数に
  - AbortController タイムアウト（12秒）も共通化
- token refresh ロジック（partner-calendar 内）と `/api/refresh-token` の重複も同ファイルに集約

完了条件: 自分のカレンダー・パートナーのカレンダーがそれぞれ動くことを実機確認。
リスク: 中。外部API連携なので実機確認必須。

---

## フェーズ4: 巨大コンポーネントの分割

行数の多い順に、**1コンポーネント=1コミット**で分割。表示・挙動は変えない。

### 4-1. SplitTab (756行) → 4ファイル

```
src/components/split/
  SplitTab.tsx        … 状態管理と組み立てのみ (~200行)
  ReceiptSheet.tsx    … レシート入力シート
  SessionList.tsx     … 履歴リスト + RatioInput
  SubscriptionList.tsx … サブスク管理
  lib.ts              … getBillingPeriod / getCurrentPeriod / fmtYen / RATIO_KEY
```

### 4-2. CookTab (641行) → 4ファイル

```
src/components/cook/
  CookTab.tsx       … 月グリッドと状態 (~250行)
  EditSheet.tsx     … 食事編集シート（現在280行のネスト）
  DayCell.tsx       … 日セル（現在props 9個 → props型を整理）
  gacha.ts          … rollGacha / pick / freshPool / 履歴管理
```

### 4-3. CalendarTab (617行) → 4ファイル

```
src/components/calendar/
  CalendarTab.tsx   … ビュー切替と状態 (~200行)
  MonthGrid.tsx     … 月グリッド（run/ride塗り・食事ドット含む）
  WeekStrip.tsx + WeekAgenda.tsx
  TaskInput.tsx     … run/ride タスク追加フォーム
  freeTime.ts       … hasEventInWindow / bothHaveAllDayEvent / hasAllDayBlock
```

`freeTime.ts` は CookTab と CalendarTab で同一の「自動フリー判定」ロジックを共有するため特に重要（現在2箇所に重複していて、過去に片方だけ直して不整合が起きた実績あり）。

### 4-4. AddRecipeModal (468行) → 写真処理 / フォーム / API呼び出しに分割

完了条件: 各タブの見た目・操作が分割前と完全一致（スクショ比較）。tsc / build / テスト緑。
リスク: 中。機械的な移動が中心だが、状態の持ち上げ・props 整理でミスが出やすい。1ファイルずつ。

---

## フェーズ5: UI 共通部品の抽出

フェーズ4で分割したコンポーネントから共通パターンを括り出す。

1. **`<BottomSheet>`** — EditSheet / ReceiptSheet の backdrop + シート構造を共通化
2. **`<Dot>` / `<Pill>`** — 食事ドット、run/ride 表示、all-day イベントピルの統一
3. **色の定数化** — `rgba(251,146,60,0.06)` 等の直書きを `src/lib/colors.ts`（または Tailwind theme）へ。run=orange / ride=cyan / free=blue / dinner=purple / lunch=amber を1箇所で定義
4. **エラー表示の統一** — store に `error` があるのに表示されないタブに共通のエラーバナーを表示

完了条件: 見た目が変わらないこと（色の定数化は値そのまま移動）。
リスク: 低。

---

## フェーズ6: 型とレガシーデータの整理

### 6-1. `highlight_*` レガシー meal_type の廃止

1. DB migration: `meal_type='highlight_dinner'` → `meal_type='dinner', recipe_id=null, label=null` に一括更新（lunch も同様）
2. 移行確認後、型から `"highlight_dinner" | "highlight_lunch"` を削除し `isHighlightPlan` を単純化

※ DB を触る唯一のフェーズ。実行前に件数確認、実行後に Cook タブのハイライト表示を確認。

### 6-2. SplitTab の `__ratio__` マジックアイテム

- 比率を items 配列に `{name: "__ratio__", price: 0.5}` として紛れ込ませている現状はスキーマの濫用
- `split_sessions` に `her_ratio` カラムを追加する migration + 読み書きを移行（読み取りは当面両対応）

### 6-3. DB行型とAPI型の分離

- `types/index.ts` を `types/db.ts`（テーブル行）と `types/app.ts`（アプリ内モデル）に分け、`as` キャストを削減

完了条件: 既存データが正しく表示されること（特に過去のハイライト・過去の split 履歴）。
リスク: **高（データ移行を含む）**。必ず単独フェーズとして実施し、migration 前にデータ確認。

---

## フェーズ7: 仕上げ

1. authStore (365行) の分割 — auth 状態 / Google token 管理 / キャッシュの3モジュールに
2. visibilitychange + ポーリングの共通フック `useForegroundRefresh(callback)` を作り、CalendarTab / SplitTab / authStore の3実装を統一
3. テストカバレッジ拡充（フェーズ0の固定テスト + 分割後のモジュール単位テスト）
4. 最終 grep 監査: 重複ヘルパー0件、直書き localStorage キー0件、`any` 0件

---

## 実施順序とリスクまとめ

| フェーズ | 内容 | リスク | 依存 |
|---|---|---|---|
| 0 | テスト基盤 | なし | — |
| 1 | ユーティリティ統合 | 低 | 0 |
| 2 | store 統一 | 中 | 1 |
| 3 | API route 統合 | 中 | 1 |
| 4 | コンポーネント分割 | 中 | 1, 2 |
| 5 | UI 部品抽出 | 低 | 4 |
| 6 | 型・DB 移行 | **高** | 2 |
| 7 | 仕上げ | 低 | 全部 |

原則:
- 1フェーズ = 複数の小さいコミット。各コミットで build + テストが通る状態を維持
- 動作変更とリファクタを同じコミットに混ぜない
- フェーズ6（DB migration）だけは実施前に必ず確認を取る
