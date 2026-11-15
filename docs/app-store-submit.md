# App Store 提出の入力シート（バージョン 1.0）

App Store Connect の画面に出てくる順に並べてある。上から順にコピペしていけば提出まで終わる。
文章の元は `docs/app-store-listing.md`。機能や料金を変えたら、両方を直すこと。

用意してある画像（このリポジトリの中）:

| ファイル | 使う場所 |
|---|---|
| `docs/app-store-assets/screenshots/01-home.png` 〜 `06-split.png` | ① バージョンのスクリーンショット（iPhone 6.9インチ） |
| `docs/app-store-assets/subscription-review.png` | ⑧ サブスクの審査用スクリーンショット |

スクリーンショットは見本のデータで撮ったもの（人名・予定・金額はすべて架空）。
1290×2796 で、6.9インチの枠にそのまま入る。6.5インチ以下は Apple が縮小して使うので不要。

---

## ① バージョン 1.0 のページ（Distribution → iOS App → 1.0）

### スクリーンショット
**iPhone 6.9インチディスプレイ**に、`01` から `06` の順でドラッグする。

> **iPad の枠も「必須」になっている場合**は、アプリが iPad 対応でビルドされている。
> 知らせてくれれば iPad 用（2064×2752）も作る。

### プロモーションテキスト
```
予定・家事・買い物・献立・割り勘を、2人で1つに。はじめての方は1か月無料。
```

### 概要
```
2人で暮らす人のための、暮らしの共有アプリです。

・予定　2人の Google カレンダーを1つの画面に並べて、どちらがいつ空いているかひと目で分かります
・家事　毎日・毎週・毎月の家事を登録し、どちらがやったかを記録。時刻を決めて通知も受け取れます
・買い物　買うものを2人で共有。自分だけのメモも置けます
・献立とレシピ　その日の昼と夜に何を食べるかを共有。レシピは URL を貼るか写真を撮って取り込めます
・割り勘　立て替えや光熱費を記録して、締め日ごとに精算額を出します

1人でも使えます。あとから招待コードで相手を招けば、2人用に切り替わります。

【料金】
すべての機能を、月額300円（税込）でご利用いただけます。
はじめての方は最初の1か月が無料です。無料期間が終わると自動的に月額300円の有料プランに移行し、
無料期間の終了24時間前までに解約すれば料金はかかりません。
2人で使う場合は、2人ともの加入が必要です。
解約は iPhone の「設定 → Apple ID → サブスクリプション」からいつでも行えます。

【プライバシー】
Google カレンダーは読み取り専用で、予定をサーバーに保存することはありません。
写真は非公開で保存され、見られるのはご本人と、一緒に使っているお相手だけです。

利用規約: https://imbrex.app/terms
プライバシーポリシー: https://imbrex.app/privacy
```

### キーワード
```
家事,分担,同棲,カップル,共有,カレンダー,買い物リスト,献立,レシピ,割り勘,二人暮らし,夫婦
```

### サポート URL
```
https://imbrex.app/about
```

### マーケティング URL
```
https://imbrex.app/about
```

### バージョン
```
1.0
```

### 著作権
```
2026 keiichiro kato
```

### ビルド
「ビルドを追加」→ **Build 5**（またはそれ以降の最新）を選ぶ。

### App 内課金とサブスクリプション ⚠️ 忘れると落ちる
「App 内課金またはサブスクリプションを選択」→ **Premium Monthly**（`com.keikato.homeapp.premium.month`）にチェック。

### App Review に関する情報

| 欄 | 入れるもの |
|---|---|
| サインインが必要 | **チェックを入れる** |
| ユーザー名 | `imbrextest@gmail.com` |
| パスワード | imbrextest の**新しいパスワード**（提出前に変えておく。前のものは Google に平文で送っているため） |
| 連絡先（姓・名・電話・メール） | 自分の連絡先。審査で問題があったときに Apple から連絡が来る |

**メモ**
```
Imbrex is a household-sharing app for one or two people living together. The UI is in Japanese.

Sign-in: tap "Sign in with Google" and use the demo account above. "Sign in with Apple" works with any Apple ID.

Subscription: all features require the "Imbrex プレミアム" auto-renewable subscription (JPY 300 per month, with a one-month free trial for new subscribers). The demo account has complimentary access, so every feature is available without purchasing.
To see the purchase flow, sign in with Apple using a different Apple ID, choose "1人で使う", and enter a display name. The subscription screen then appears, showing the price, trial terms, Restore Purchases, Terms of Use and Privacy Policy. It is also reachable from Settings → premium.

After signing in with the demo account:
1. Home shows today's chores, shared to-dos and the weather.
2. Calendar shows the demo account's Google Calendar events (read-only, calendar.readonly; this app has passed Google's OAuth verification). Accounts that signed in with Apple can connect Google Calendar from the prompt on Home ("連携する").
3. Recipes: add a recipe by pasting a recipe page URL or taking a photo.
4. Chore reminders: Settings → notification. Local notifications only; no push server.
5. Two-person features (shared view, expense splitting) appear after a second subscribed account joins with the invite code shown in Settings → household.

Account deletion: Settings → bottom of the page → "アカウントを削除". It is available whether or not the user is subscribed.
```

### バージョンのリリース
**「このバージョンを手動でリリースする」**を選ぶ。承認されたあと、公開のタイミングを自分で決められる。

---

## ② App 情報（左メニュー「App 情報」）

| 欄 | 入れるもの |
|---|---|
| 名前 | `Imbrex` |
| サブタイトル（30文字以内） | `二人の暮らしを一枚に` |
| カテゴリ（プライマリ） | **ライフスタイル** |
| カテゴリ（セカンダリ） | **仕事効率化** |
| コンテンツ配信権 | 「サードパーティのコンテンツを含む／表示する」→ **いいえ**（取り込んだレシピは利用者が自分で入れたもの） |

### 年齢制限（「年齢制限」の編集）
すべて **なし／いいえ** で答えると **4+** になる。迷いやすいところ:

| 質問 | 答え | 理由 |
|---|---|---|
| ユーザー生成コンテンツ・他人とのやり取り | いいえ | 入力は世帯の2人の間だけ。不特定の人とは共有しない |
| 制限なしの Web アクセス | いいえ | レシピの元ページを Safari で開くリンクがあるだけで、アプリ内ブラウザは無い |
| ペアレンタルコントロール・年齢確認 | いいえ | |
| 広告 | いいえ | |

---

## ③ 価格および配信状況（左メニュー）

| 欄 | 入れるもの |
|---|---|
| 価格 | **無料（0円）**（課金はサブスクで行う） |
| 配信状況 | **日本のみ** |

---

## ④ App のプライバシー（左メニュー）

| 欄 | 入れるもの |
|---|---|
| プライバシーポリシー URL | `https://imbrex.app/privacy` |
| データの収集 | 「**はい、このAppからデータを収集します**」 |

次の7つにチェックし、それぞれ **「Appの機能」**・**「トラッキングに使用しない」** と答える。

| 種類 | ユーザーに紐づく |
|---|---|
| 連絡先情報 → 名前 | はい |
| 連絡先情報 → メールアドレス | はい |
| ユーザコンテンツ → 写真またはビデオ | はい |
| ユーザコンテンツ → その他のユーザコンテンツ | はい |
| 識別子 → ユーザID | はい |
| 購入 → 購入履歴 | はい |
| 位置情報 → おおよその場所 | **いいえ**（天気の表示にだけ使い、保存しない） |

最後に右上の **「公開」** を押す（押さないと提出できない）。

---

## ⑤ サブスクリプション（左メニュー「サブスクリプション」→ Imbrex Premium → Premium Monthly）

| 欄 | 入れるもの |
|---|---|
| 審査に関する情報 → スクリーンショット | `docs/app-store-assets/subscription-review.png` |
| 審査メモ | 下の文 |

```
Open Settings > premium > "プランを見る" (or sign in with a new account) to see the purchase screen.
1-month free trial, then JPY 300/month. All features require this subscription.
Test account details are in the App Review Information of the app version.
```

商品のページで **「審査へ追加」は押さない**。①のバージョンのページで追加すれば、アプリと一緒に審査に出る。

---

## ⑥ 提出

1. ①のページの右上 **「審査用に追加」** → **「審査へ提出」**
2. 輸出コンプライアンスを聞かれたら、**「標準の暗号化（HTTPS）のみ」**（どれにも該当しない）を選ぶ
3. 状態が **「審査待ち」** になれば完了。結果は通常1〜3日でメールが来る

### 提出前の最終確認
- [ ] Apple でのログインが通る（「Sign Up Not Completed」が直っている）
- [ ] ログイン画面の「SIGN-IN LOG」を消したビルドが imbrex.app に出ている
- [ ] imbrextest のパスワードを変えて、①のパスワード欄に新しいものを入れた
- [ ] imbrextest に付与がある（`select public.member_premium_source(id) from auth.users where email = 'imbrextest@gmail.com';` が `grant`）
- [ ] 契約・口座・税金がすべて Active
