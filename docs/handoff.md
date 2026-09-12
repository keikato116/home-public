# 引き継ぎメモ（2026-09-11 時点）

App Store 公開版を作っているセッションからの引き継ぎ。
技術的な詳細は [docs/app-store.md](app-store.md) にあるので、ここでは
**いまどこまで進んでいて、次に何をするか**だけを書く。

## このリポジトリは何か

`keikato116/Home`（彼女と2人で使っている web app）を土台に、App Store 公開用として
分けたリポジトリ。履歴はそのまま引き継いでいる。

公開版だけにある機能:

- レシピと献立を月額サブスク対象にする課金ゲート（RevenueCat + Supabase）
- ソロモード（1人でも使える。Guideline 4.2 対策）
- アカウント削除（Guideline 5.1.1(v) 対策）
- グループの解散と、「部屋」（ペアの期間）によるデータの見える範囲の制御
- 利用規約 / プライバシーポリシーのページ
- Bundle ID が別（`com.keikato.homeapp`）

**元の `keikato116/Home` は触らないこと。** あちらは本人たちが毎日使っている本番。

## いまの状態

**2026-09-12: ブラウザで動くところまで確認済み。**
Vercel にデプロイし（`https://home-public.vercel.app`）、公開版専用の Supabase に
繋いで Google ログインが通るところまで到達した。実機（iOS）はまだ未確認。

そこまでに必要だった設定:

- Vercel の環境変数に Supabase の URL と anon / service_role キー
  （`NEXT_PUBLIC_` の2つは Vercel の警告に対して "Change to Config" を選ぶ。
  　anon キーは公開前提で、守っているのは RLS のほう）
- Supabase の Authentication → Providers → Google を有効化し、
  Google Cloud Console の Client ID / Secret を入れる（**新プロジェクトでは未設定なので忘れやすい**）
- Google Cloud Console の承認済みリダイレクト URI に
  `https://<ref>.supabase.co/auth/v1/callback` を追加
- **Supabase の Authentication → URL Configuration**
  Site URL: `https://home-public.vercel.app`／Redirect URLs: 同 `/**`
  → これを入れるまで、ログイン後に `localhost` に飛ばされ続ける
  （Supabase は許可リストに無い戻り先を既定の Site URL に差し戻す。その初期値が localhost）

### 設計の要点（触る前に読む）

**課金判定の正は Supabase**。`subscriptions` テーブルに RevenueCat の webhook が書き、
`household_entitled()` が判定する。WebView が読むのは Vercel 上の web アプリなので、
クライアントの申告を信じると DevTools から有料機能が使い放題になる。
判定を増やすときも必ず DB 側に置くこと。

**ソロ判定はフラグではなく人数から導出**している（`memberCount <= 1`）。
フラグを足すと状態が二重になってズレるので、増やさない。

**「部屋」= ペアの期間**。`households.pairing_started_at` が現在の部屋の開始時刻で、
`household_members` の insert/delete でトリガーが更新する。
割り勘と共有買い物リストはこの時刻以降の行だけ見える（restrictive な select ポリシー）。
レシピと自分専用の買い物アイテムは部屋をまたぐ。

なぜ必要か: 1人に戻ると割り勘タブは消えるがデータは残る。次に別の人を招待すると
タブが再表示され、**前の相手とのお金の記録が新しい相手に見えてしまう**。
特に `split_subscriptions` は日付で絞らず `active = true` を全部読むので即座に出る。

### ハマりどころ（実際にハマったもの）

- **`/api/partner-calendar` は service role で `user_tokens` を `household_id` で引く。**
  「いま世帯にいるか」は見ていない。だから解散時に `household_members` を消すだけでは
  相手のカレンダーが見え続ける。`user_tokens.household_id` の付け替えが必須。
- **`shopping_items.user_id` が入っている行 = 本人だけに見える非公開アイテム。**
  持ち主が消えたときに user_id だけ null にすると「みんなのもの」になり、
  非公開メモが相手に見える。消すなら行ごと消す。
- **`routine_definitions.user_id` は担当者**（世帯で共有するもの）、
  **`local_calendar_events.user_id` は作成者**。どちらも「その人のもの」ではない。
- **アカウント削除は外部キーを直さないと不可能だった。** `auth.users` を参照する
  外部キーの大半が ON DELETE 指定なしで、削除しようとすると制約違反になる。
- **Apple のサブスクはアプリから解約できない。** App Store Server API に解約の
  エンドポイントが無い。削除画面で解約画面に誘導し、チェックを入れさせてから
  削除させている。「自動で止める」実装は不可能なので試さないこと。

## 次にやること（順番どおり）

### 1. Supabase を公開版専用プロジェクトに分ける（✅ 2026-09-12 完了）

公開版専用の organization とプロジェクトを作り、`schema.sql` + マイグレーション3本を
実行済み。新プロジェクトで確認済みの状態:

| 項目 | 結果 |
|---|---|
| テーブル数 | 15 |
| RLS 有効 | 15 / 15 |
| Data API 権限 | 15 / 15 |
| ポリシー数 | 27 |
| `household_entitled()` | あり |
| `pairing_scope` 確認クエリ | 4行とも true |

organization を分けたのは課金のため。Supabase の課金は organization 単位で、
同じ org の中で Free と Pro を混ぜられない。公開版を Pro に上げるとき、
同居させていると個人用まで巻き込まれる。

**審査に出すときは公開版を Pro にする前提で考えること。** Free は1週間
アクセスが無いと自動で一時停止する。審査待ちの間に止まると、レビュアーが
開いたときにアプリが動かず、それだけで差し戻される。

残っているのは Vercel の環境変数の差し替え（下記2）と、個人用プロジェクトの
後始末（下記）。

#### 個人用プロジェクトの後始末

前セッションは「公開版用のマイグレーション3本が個人用に流れている」と書いていたが、
2026-09-12 に個人用の構造を実際に見たところ**そうではなかった**:

- `subscriptions` テーブルなし、`household_entitled()` なし → 課金ゲートは入っていない
- `households.pairing_started_at` なし、トリガーなし → 部屋の区切りも入っていない
- ただし auth.users を参照する外部キーは全て ON DELETE 付きに直っている
  → `2026-09-11_account_deletion.sql` だけは適用済み

つまり個人用のレシピと献立は保存できる状態のはずで、
`supabase/rollback/2026-09-11_revert_public_edition.sql` を流す必要はおそらく無い。
流す前に、個人用で下のクエリが 0 を返すことを確認すること（0 なら不要）。

```sql
select count(*) from pg_proc
where pronamespace = 'public'::regnamespace and proname = 'household_entitled';
```

### 旧: Supabase を分ける手順（記録として残す）

**いま、公開版用のマイグレーション3本が、個人用（彼女と2人で使っている web app）の
Supabase に流された状態**になっている。課金ゲートを入れた時点で個人用のレシピと
献立が保存できなくなり、手で課金済みの行を入れて回避する話をしたところで止まっている。

分ける方針は本人合意済み。公開版はまだ利用者0人なのでデータ移行が不要で、いまが一番安い。

手順は [docs/app-store.md](app-store.md) の「1. Supabase」にある。ざっくり:

1. Supabase で新規プロジェクトを作る
2. `supabase/schema.sql` → マイグレーション3本を順に実行
   （`schema.sql` は 2026-09-12 に実データベースから作り直した。
   　以前の版は meal_plans / split_sessions / split_subscriptions /
   　family_card_totals / diary_entries の5テーブルが欠けていた）
3. 公開版の Vercel に新プロジェクトの URL とキーを設定
4. 個人用プロジェクトから公開版のルールを外す
   → `supabase/rollback/2026-09-11_revert_public_edition.sql`
   （**公開版のプロジェクトでは絶対に流さない**）

> SQL Editor には**ファイルの中身**を貼る。パスを貼っても実行できない（実際にこれで2回詰まった）。

**確認済み（2026-09-12）**: `pairing_scope` の最後に出る確認クエリは、
まっさらな Postgres に `schema.sql` → マイグレーション3本を流した状態で
**4行とも true** になることを実際に実行して確かめた。
新プロジェクトでも同じ結果になるはずだが、流したあと目視で確認すること。

ただし**これは作り直した `schema.sql` を使った場合の話**。以前の `schema.sql` には
split_sessions / split_subscriptions / family_card_totals が無かったため、
`pairing_scope` はこの3表を「見つからない表」として飛ばしていた
（コミット `769b4cc` がそのための変更）。つまり古い手順で新プロジェクトを
作っていたら、**割り勘に「部屋」の区切りが一切かからないまま公開していた**。
前の相手とのお金の記録が新しい相手に見える、というまさに防ぎたかった事故が
起きる状態だったので、schema.sql を直すまで新プロジェクトを作らないこと。

### 2. デプロイと課金の疎通

- Vercel に公開版をデプロイ。環境変数は `.env.local.example` を見る
  （RevenueCat の `NEXT_PUBLIC_REVENUECAT_IOS_API_KEY` と `REVENUECAT_WEBHOOK_SECRET` が追加分）
- App Store Connect と RevenueCat の設定 → docs/app-store.md
- Xcode で `npm run ios:add` → In-App Purchase capability を追加
- Sandbox で動作確認。チェックリストは docs/app-store.md にある

### 3. 審査準備

コードでは埋まらない分:
審査用デモアカウント（課金済み状態にする）、スクリーンショット2サイズ、
App プライバシー申告、サポートURL。

`/terms` と `/privacy` は**ドラフト**。実装に合わせて書いてあるが法的レビューはしていない。
公開前に本人の確認が要る。

## 未決の設計判断（本人に聞くこと）

### A. やること・献立・ローカル予定・家事ルーティンを部屋で区切るか

いまは区切っていない。つまり前の相手と作ったやることや献立が、新しい相手にも見える。

**前セッションの提案**（本人未回答）:

| データ | 提案 | 理由 |
|---|---|---|
| 家事ルーティン | 引き継ぐ | 生活の土台。消えると作り直しで失うものが大きい |
| やること | 引き継ぐ | 進行中の用事 |
| 献立 | 引き継ぐ | レシピを引き継ぐのに献立だけ消えるとちぐはぐ。機微も低い |
| ローカル予定 | **未来の分だけ** | 先の予定を消すと約束をすっぽかす。過去は前の相手との記録 |

あわせて、家事ルーティンを引き継ぐなら**抜けた人が担当だった家事の担当を外す**必要がある。
担当者名は「いま世帯にいる人」から引いているので、抜けた人のIDは名前に変換できず
担当者が空欄のルーティンになる。

### B. 新しい部屋に入ったときのコンフリクト

解散時、抜ける人は新しい1人用の世帯に、レシピ・ルーティン・やること・献立の**複製**を
持っていく（実装済み）。その人が後日べつの人の部屋に**参加**したとき、
持っているデータと相手のデータをどうするか。

**前セッションの考え**: 自動マージしない。参加したらその部屋のデータを使い、
自分のデータは自分の世帯に残す。マージすると、せっかく入れた「部屋の区切り」を
自分で破ることになる（前の相手との献立が新しい相手に見える）。
レシピだけは明示的な「取り込み」操作を用意してもよい。

### C. 置いていかれる世帯が溜まる

B に関連。参加すると、その人の1人用世帯はメンバー0人のまま残る。
誰にも見えないが行としては残り続ける。放置でよいか、再利用するか、消すか。

## 残っている雑務

- `keikato116/Home` に `claude/wizardly-ritchie-rx1yo5` ブランチが残っている。
  中身はこのリポジトリの main と同一（`f7f4a69`）。本人が GitHub の画面から消す予定。
  セッションの git プロキシはブランチ削除を 403 で拒否するので、コマンドでは消せない。

## 本人とのやりとりについて

日本語。専門用語より「何が起きるか」で説明したほうが通じる。
仕様の抜けを鋭く突いてくるので（非公開リストの取り残し、割り勘の引き継ぎが
成立していない件は本人の指摘で見つかった）、実装前に前提を言葉で確認すると早い。
