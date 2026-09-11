# App Store 公開と課金

このリポジトリ（home-public）は、内輪用の home を App Store 公開向けに分けたもの。
レシピ機能と献立カレンダーを月額サブスクの対象にしてある。

## 課金の仕組み

```
iOS アプリ（Capacitor + RevenueCat SDK）
   │  ① 購入
   ▼
App Store（StoreKit）
   │  ② 購入確定を通知
   ▼
RevenueCat
   │  ③ Webhook  POST /api/revenuecat/webhook
   ▼
Supabase  subscriptions テーブル  ← 課金状態の唯一の正
   │  ④ household_entitled() で判定
   ▼
アプリ（タブの出し分け）／ RLS（書き込み制限）／ API（402 を返す）
```

**なぜクライアントの判定を信用しないか**: WebView が読むのは Vercel 上の Web アプリなので、
ブラウザからも同じ Supabase を叩ける。「購入済みかどうか」をクライアントが決めると、
DevTools から自由に有料機能を使えてしまう。判定は必ず `household_entitled()`（DB 側）で行う。

### 課金は世帯単位

世帯のだれか1人が課金していれば、同じ世帯のもう1人も使える。2人で使うアプリなので
「片方だけレシピが見えない」状態を避けるための設計。1人1契約にしたい場合は
`supabase/migrations/2026-09-11_subscriptions.sql` の `household_entitled()` から
`household_members` 経由の JOIN を外す。

### 無料ユーザーの見え方

レシピタブと献立（cook）タブは**タブごと消える**。購入導線は「設定 → premium」のみ。

> ⚠️ この方式は審査でのリスクがある。審査員は無料状態のアプリしか見ないため、
> 何を買うのか分からないと Guideline 2.1 / 3.1.2 で差し戻されることがある。
> **対策**: 審査メモに「設定 → premium から購入画面が開く」と明記し、
> かつ課金済みのデモアカウント（下記）を必ず渡す。

## セットアップ

### 1. Supabase

SQL Editor で、この2本をこの順に実行する。

1. `supabase/migrations/2026-09-11_subscriptions.sql`
   — `subscriptions` テーブル、`household_entitled()`、recipes / meal_plans への restrictive ポリシー
2. `supabase/migrations/2026-09-11_account_deletion.sql`
   — auth.users を参照する外部キーを ON DELETE SET NULL / CASCADE に張り直す

2 本目を流さないと、アカウント削除が外部キー違反で失敗する。
流したあと、末尾のコメントにある確認クエリが 0 件になることを見ておくとよい。

### 2. App Store Connect

1. 新規 App を作成（Bundle ID: `com.keikato.homeapp` — `capacitor.config.ts` と一致させる）
2. サブスクリプショングループを作成し、商品を登録
   - 月額: `com.keikato.homeapp.premium.monthly`
   - 年額（任意）: `com.keikato.homeapp.premium.yearly`
3. 各商品に審査用のスクリーンショットと説明を登録（未登録だと商品が審査に出せない）
4. 「契約、税金、および口座情報」で有料App契約を締結する
   — **これが済んでいないと商品が一切取得できず、購入画面が空になる**

### 3. RevenueCat

1. プロジェクトを作り、App Store Connect と連携（App-Specific Shared Secret が必要）
2. Entitlement を **`premium`** という識別子で作る（`src/lib/constants.ts` の `RC_ENTITLEMENT_ID` と一致）
3. Offering（`default`）に上で作った商品を Package として登録
4. Integrations → Webhooks に登録
   - URL: `https://<デプロイ先>/api/revenuecat/webhook`
   - Authorization ヘッダー: `REVENUECAT_WEBHOOK_SECRET` と同じ値
5. 公開APIキー（`appl_` で始まる）を `NEXT_PUBLIC_REVENUECAT_IOS_API_KEY` に設定

### 4. Vercel

環境変数に `NEXT_PUBLIC_REVENUECAT_IOS_API_KEY` と `REVENUECAT_WEBHOOK_SECRET` を追加して再デプロイ。

### 5. Xcode

```bash
npm install
npm run ios:add      # 初回のみ
npm run ios:sync     # RevenueCat の Pod もここで入る
npm run ios:open
```

Signing & Capabilities で **In-App Purchase** を追加する。

### 6. Sandbox で動作確認

App Store Connect → ユーザーとアクセス → Sandbox テスターを作成し、
実機の「設定 → App Store → Sandbox アカウント」でサインインしてから購入する。

確認すること:

- [ ] 1人で始めると割り勘タブが出ない
- [ ] 招待コードで相手が参加すると割り勘タブが出る
- [ ] パートナーを外すとソロに戻る
- [ ] アカウント削除ができ、削除後にサインイン画面に戻る
- [ ] 未購入だとレシピ／献立タブが出ない
- [ ] 設定 → premium から購入画面が開き、価格が表示される
- [ ] 購入するとタブが出る
- [ ] アプリを消して入れ直し、「購入を復元」でタブが戻る
- [ ] 世帯のもう1人のアカウントでもタブが出る
- [ ] Supabase の `subscriptions` に行ができている（= webhook が届いている）

## ソロモードとアカウント削除

どちらも審査の必須要件なので実装済み。

### ソロモード（Guideline 4.2 対策）

モードはフラグではなく、**世帯のメンバー数から導出**している（1人ならソロ）。
状態が二重にならないので、フラグとメンバー数がずれる事故が起きない。

- 初回セットアップで「1人で使う / 2人で使う / 招待コードで参加する」を選ぶ
- ソロのあいだは**割り勘タブを隠す**（him / her の2人前提で成立しない）
- 設定 → household から、招待コードを渡せばペア、パートナーを外せばソロに戻る
- 外せるのは世帯を作った人だけ（`/api/household/remove-member`）。
  どちらからでも相手を追い出せると、一方的にデータを見せなくする操作が成立してしまう

### アカウント削除（Guideline 5.1.1(v) 対策）

設定の一番下 → 「アカウントを削除」→ 確認 → `DELETE /api/account`。

- 世帯に自分しかいない場合は**世帯ごと削除**（cascade で全データが消える）
- パートナーが残る場合は自分だけ抜ける。相手のデータは消えない
- 課金は Apple 側の契約なので、アカウントを削除しても自動更新は止まらない。
  確認画面でその旨を明示している（ここを黙っていると請求トラブルになる）

## 審査までに必要な残作業

コードでは埋まらない項目。

| 項目 | なぜ必要か |
|---|---|
| **審査用デモアカウント** | Google サインインがあるので必須。課金済み状態にしておく（`subscriptions` に手で status='active' の行を入れる） |
| **スクリーンショット** | 6.9インチ・6.5インチの2サイズ |
| **App プライバシー申告** | 収集項目の申告。`/privacy` の内容と食い違わせない |
| **サポートURL** | App Store Connect の必須項目 |

`/terms` と `/privacy` はドラフト。**公開前に内容を必ず自分で確認すること**（実装に合わせて
書いてあるが、法的なレビューはしていない）。

## つまずきやすいところ

**購入画面にプランが出ない** — ほぼ「有料App契約が未締結」か「商品が Ready to Submit になっていない」。
RevenueCat のダッシュボードで Offering に商品が紐付いているかも確認する。

**購入したのにタブが出ない** — webhook が届いていない。RevenueCat の Webhook ログで
401 が出ていないか（`REVENUECAT_WEBHOOK_SECRET` の不一致）、`subscriptions` に行ができているかを見る。
購入直後は SDK の応答で先に開放し、4秒後に DB を読み直す作りなので、
数秒は先読み状態で動く。

**購入直後に保存だけ失敗する** — webhook が届く前に書き込むと RLS で弾かれる。
数秒待って再試行すれば通る。頻発するようなら `subscriptionStore` の refresh 遅延（4秒）を延ばす。

**Web（ブラウザ）では買えない** — RevenueCat はネイティブ限定なので仕様。
ブラウザでは購入画面に「iPhone アプリから購入してください」と出る。
