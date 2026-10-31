# App Store Connect に入れる文章（2026-10-28 時点）

アプリの中身と食い違うと差し戻されるので、**機能や料金を変えたらここも直すこと**。
利用規約（`/terms`）・プライバシーポリシー（`/privacy`）・/about と内容を揃えてある。

## 概要（説明文）

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

## プロモーションテキスト（170文字以内・審査なしで変えられる）

```
予定・家事・買い物・献立・割り勘を、2人で1つに。はじめての方は1か月無料。
```

## キーワード（100文字以内）

```
家事,分担,同棲,カップル,共有,カレンダー,買い物リスト,献立,レシピ,割り勘,二人暮らし,夫婦
```

## URL

| 項目 | 値 |
|---|---|
| サポートURL | `https://imbrex.app/about` |
| マーケティングURL | `https://imbrex.app/about` |
| プライバシーポリシーURL | `https://imbrex.app/privacy` |
| 利用規約（EULA） | Apple 標準の EULA のまま。概要文の末尾に `/terms` を載せる（サブスクのあるアプリは必須） |

## サブスクリプション商品

| 項目 | 値 |
|---|---|
| 参照名 | Premium Monthly |
| 製品ID | `com.keikato.homeapp.premium.month` |
| 期間 | 1か月 |
| ファミリー共有 | **オフ**（一度オンにすると戻せない。`…premium.monthly` はこれで作り直しになり、同じ ID は二度と使えない） |
| 価格 | 300円 |
| 導入オファー | 無料・1か月・日本 |
| 表示名（日本語） | Imbrex プレミアム |
| 説明（日本語） | 予定・家事・買い物・献立・割り勘のすべての機能が使えます |
| 審査用スクリーンショット | 購入画面（設定 → premium →「プランを見る」）を撮ったもの |

**バージョンのページで、この商品を「App内課金とサブスクリプション」に追加してから提出すること。**
忘れると商品が審査に出ず、購入画面が空のまま審査されて落ちる。

## App のプライバシー

「データを収集する」→ 次の6つ。すべて「トラッキングに使用しない」「目的: Appの機能」。

| 種類 | ユーザーに紐づく | 中身 |
|---|---|---|
| 連絡先情報 → 名前 | はい | 表示名 |
| 連絡先情報 → メールアドレス | はい | ログインに使ったアカウント |
| ユーザコンテンツ → 写真またはビデオ | はい | レシピに付けた写真（非公開で保存） |
| ユーザコンテンツ → その他のユーザコンテンツ | はい | 予定・家事・買い物・献立・レシピ・割り勘の入力 |
| 識別子 → ユーザID | はい | アカウントの ID（RevenueCat にも送る） |
| 購入 → 購入履歴 | はい | 加入の有無・商品・有効期限 |
| 位置情報 → おおよその位置情報 | **いいえ** | 接続元から推定。天気の表示にだけ使い、保存しない |

申告しないもの:
- Google カレンダーの予定 … サーバーに保存せず、表示のたびに取りに行くだけ
- レシピ取り込みで Anthropic に送るページの内容・写真 … 読み取りに使うだけで保存されない

## 審査メモ（App Review に関する情報）

「サインインが必要」にチェックし、ユーザー名 `imbrextest@gmail.com` と、そのアカウントの
**現在のパスワード**を入れる。このアカウントには運営の付与（`grant_premium`）で
すべての機能が使える状態にしてある。メモ欄:

```
Imbrex is a household-sharing app for one or two people living together. The UI is in Japanese.

Sign-in: use "Google でログイン" with the demo account above, or "Apple でサインイン" with any Apple ID.

Subscription: all features require the "Imbrex プレミアム" auto-renewable subscription (JPY 300 per month, with a one-month free trial for new subscribers). The demo account has complimentary access, so every feature is available without purchasing. To see the purchase flow, sign in with Apple using a different Apple ID: after entering a display name, the subscription screen appears, with the price, trial terms, Restore Purchases, Terms of Use and Privacy Policy. It is also reachable from Settings → premium.

After signing in with the demo account:
1. Home shows today's chores, to-dos and weather.
2. Calendar: tap "Google カレンダーを連携" to show Google Calendar events (read-only, calendar.readonly; this app has passed Google's OAuth verification).
3. Recipes: add a recipe by pasting a recipe page URL or taking a photo.
4. Chore reminders: Settings → notifications. Local notifications only; no push server.
5. Two-person features (shared view, expense splitting) appear after a second subscribed account joins with the invite code shown in Settings → household.

Account deletion: Settings → bottom of the page → "アカウントを削除". It is available whether or not the user is subscribed.
```

## 決めたこと（提出に関係するもの）

- 配信は日本のみ
- 特定商取引法に基づく表記のページは置かない（2026-10-28 決定）
