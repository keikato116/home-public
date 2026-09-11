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
3. `supabase/migrations/2026-09-11_pairing_scope.sql`
   — 「部屋」（ペアの期間）の導入。割り勘と共有買い物リストを現在の部屋に限定する

2 本目を流さないと、アカウント削除が外部キー違反で失敗する。
流したあと、末尾のコメントにある確認クエリが 0 件になることを見ておくとよい。

#### 適用できたかの確認

`account_deletion` の方は該当がなければ黙って何もせず終わるので、結果を見ておく。

```sql
-- 1) 課金判定の関数がある
select proname from pg_proc where proname = 'household_entitled';

-- 2) 有料機能の書き込み制限が入っている（4行返る）
select tablename, policyname from pg_policies
where policyname like 'premium required%';

-- 3) auth.users を参照する外部キーに、未対応（NO ACTION / RESTRICT）が残っていない
--    → 0 件ならアカウント削除が通る
select cl.relname as table_name, att.attname as column_name
from pg_constraint con
join pg_class cl      on cl.oid = con.conrelid
join pg_class rf      on rf.oid = con.confrelid
join lateral unnest(con.conkey) as k(attnum) on true
join pg_attribute att on att.attrelid = cl.oid and att.attnum = k.attnum
where con.contype = 'f' and rf.relname = 'users' and con.confdeltype in ('a','r');
```

#### 自分（と審査員）を課金済みにする

**既存の Supabase プロジェクトにそのまま流した場合、この作業は必須。**
`premium required%` のポリシーは全ユーザーに効くので、`subscriptions` に行が無いと
レシピと献立が保存できなくなる（今まで使っていた人も含めて）。

```sql
-- メールアドレスから user_id を引いて、期限なしの有効な行を入れる
insert into public.subscriptions (user_id, product_id, status, expires_at, environment)
select id, 'manual_grant', 'active', null, 'MANUAL'
from auth.users
where email in ('自分のメールアドレス', '審査用アカウントのメールアドレス')
on conflict (user_id) do update
  set status = 'active', expires_at = null, product_id = 'manual_grant';
```

`expires_at` が null なので期限切れにならない。取り消すときはその行を削除する。

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
- [ ] どちらからでも解散でき、解散後はおたがいの予定が見えない
- [ ] 解散後、抜けた側は1人用に切り替わり、非公開の買い物リストが残っている
- [ ] 解散して別の人を招待すると、前の相手との割り勘記録が表示されない
- [ ] 同上で、レシピは引き継がれて表示される
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
- 設定 → household から、招待コードを渡せばペア、解散すればソロに戻る

**解散（`/api/household/dissolve`）はどちらからでもできる。**
押した人によらず、あとから参加した人が抜け、2人で共有していたデータは世帯を作った人に残る。
結果が押した人に依存しないので、「先に押したほうがデータを持っていく」早い者勝ちにならない。

抜ける人には**その場で新しい1人用の世帯を作り、本人にしか見えなかったデータを移す**。
いまのところ該当するのは非公開の買い物アイテム（`shopping_items.user_id` が入っている行）だけ。
`routine_definitions.user_id` は「担当者」で世帯で共有するもの、
`local_calendar_events.user_id` は作成者なので、どちらも古い世帯に残す。

移さずに置いていくと、**本人からも見えなくなる**。`shopping_items` のポリシーは
「その世帯のメンバーであること」と「自分の行であること」の両方を求めるので、
世帯を抜けた時点で持ち主の条件が外れ、相手にも本人にも見えない行として残ってしまう。

解散でカレンダーが見えなくなるのは、`household_members` を消すだけでは**不十分**。
`/api/partner-calendar` は service role で `user_tokens` を `household_id` で引くので、
抜けた人の `user_tokens` が古い世帯を指したままだと、残った側からは相手の予定が見え続ける。
解散時に `household_id` と Google トークンをまとめて消しているのはそのため。

### 部屋（ペアの期間）とデータの見える範囲

同じ世帯でも、2人の組み合わせが変われば別の「部屋」として扱う。
`households.pairing_started_at` が現在の部屋の開始時刻で、
`household_members` への insert / delete でトリガーが now() に更新する
（参加・解散・アカウント削除の cascade、どの経路でも効く）。

| データ | 部屋をまたぐか |
|---|---|
| 割り勘（sessions / subscriptions / family card total） | またがない — いまの部屋の分だけ表示 |
| 共有の買い物リスト（`user_id` が null） | またがない |
| 自分だけの買い物アイテム（`user_id` あり） | またぐ — 解散時は本人の新しい世帯へ移す |
| レシピ | またぐ |

絞り込みはクライアントのクエリではなく **restrictive な select ポリシー**で行う
（`supabase/migrations/2026-09-11_pairing_scope.sql`）。
どの画面から読んでも、また直接 Supabase を叩かれても、前の部屋の記録は返らない。

**なぜ必要か**: 1人に戻ると割り勘タブは消えるが、データは残っている。
次に別の人を招待すると割り勘タブが再表示されるので、前の相手とのお金の記録が
新しい相手の画面に出てしまう。特に `split_subscriptions` は日付で絞らず
`active = true` を全部読むので、遡らなくても即座に出る。

移行時、既存の世帯の `pairing_started_at` は世帯の作成時刻に合わせてある。
now() にすると、いま入っている割り勘データが一斉に見えなくなるため。

**まだ部屋で区切っていないもの**: やること・献立・ローカル予定・家事ルーティン。
必要になったら同じ方法（restrictive select ポリシー）で足せる。

### アカウント削除（Guideline 5.1.1(v) 対策）

設定の一番下 → 「アカウントを削除」→ 確認 → `DELETE /api/account`。

- 世帯に自分しかいない場合は**世帯ごと削除**（cascade で全データが消える）
- パートナーが残る場合、**レシピを引き継ぐかどうかだけ選べる**（既定は引き継ぐ）。
  レシピは部屋をまたいで残る唯一の共有データなので、明示的に消せる必要がある
- 割り勘と共有の買い物リストは選択の対象にしていない。相手は1人に戻り、
  部屋が変わった時点で表示されなくなるため
- 自分にしか見えないデータは、選択によらず必ず消える

レシピに作成者の記録はあるが、削除はカテゴリ単位（世帯のレシピ全部）にしている。
「引き継がない」を選んだのに相手の画面に半分残るほうが分かりにくいため。
確認画面には、相手が追加したレシピも消えることを明示している。

レシピを消すときは、先に `meal_plans.recipe_id` を null にしてから消す。
献立がレシピを参照しているので、外部キーの on delete 指定に関係なく安全にするため。

**課金は削除では止まらない。** サブスクの契約相手は開発者ではなく Apple で、
解約できるのは契約者本人だけ。アプリからも、サーバーからも、RevenueCat からも解約できない
（App Store Server API に解約のエンドポイントが存在しない）。
そのため課金中の人には、削除の確認画面で解約画面を開くボタンを先に出し、
「解約の手続きを済ませました」にチェックが入るまで削除ボタンを押せないようにしている。
黙って削除させると、アプリは消えたのに請求だけ続く状態になる。

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
