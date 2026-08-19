# iOS アプリ化とウィジェット

このアプリを iPhone のネイティブアプリとして動かし、ホーム画面ウィジェットを追加するための手順。

## 構成

Capacitor のネイティブシェル（ガワ）が、Vercel にデプロイ済みの Next.js アプリを WebView で読み込む。

```
iPhone
├── home.app          ← Capacitor シェル（Xcode でビルド）
│   └── WebView       → https://<your-app>.vercel.app を表示
└── HomeWidget        ← Swift ウィジェット拡張
        ↕ App Group 経由でデータ共有
```

**なぜサーバー URL を読む方式か**

`/api/parse-recipe` など 9 個のサーバーサイド API があるため、静的書き出し（`output: 'export'`）はできない。
サーバー URL を読む方式なら API がそのまま動き、さらに **Web の変更は `git push` するだけで
アプリに反映される**（Xcode で再ビルド不要）。再ビルドが要るのはネイティブ側を触った時だけ。

## 必要なもの

- Mac + Xcode
- iPhone（実機）
- Apple ID
  - **無料**: 動くが署名が **7日で失効**。切れたら Mac に繋いで入れ直し
  - **Apple Developer Program（年 $99）**: TestFlight でリンク配布可、ビルドは 90日有効

## セットアップ（Mac で実行）

### 1. デプロイ URL を設定

`.env.local` に追記する。

```bash
CAP_SERVER_URL=https://<your-app>.vercel.app
```

Vercel のダッシュボードで本番 URL を確認すること。独自ドメインがあればそちらを使う。

### 2. iOS プロジェクトを生成

```bash
npm install
npm run ios:add      # ios/ ディレクトリを生成（初回のみ）
npm run ios:sync     # 設定を反映（capacitor.config.ts を変えたら毎回）
npm run ios:open     # Xcode が開く
```

### 3. Xcode で署名設定

1. 左ペインで **App** ターゲットを選択
2. **Signing & Capabilities** タブ
3. **Team** に自分の Apple ID を選択
4. **Bundle Identifier** が他人と衝突する場合は `com.keikato.home` を変更

### 4. 実機にインストール

1. iPhone を Mac に USB 接続
2. Xcode 上部のデバイス選択から自分の iPhone を選ぶ
3. ▶ を押す
4. 初回は iPhone 側で **設定 → 一般 → VPN とデバイス管理** から開発者を信頼

これでアプリが起動する。

## ウィジェット追加（ステップ2）

アプリが動いたら次にウィジェットを足す。

### 1. App Group を作る

アプリとウィジェットはプロセスが別なので、データ共有には App Group が要る。

1. Xcode → **App** ターゲット → Signing & Capabilities → **+ Capability** → **App Groups**
2. `group.com.keikato.home` を追加
3. あとで作る Widget ターゲットにも**同じ App Group** を追加する

### 2. Widget Extension を追加

1. Xcode メニュー **File → New → Target**
2. **Widget Extension** を選択
3. Product Name: `HomeWidget`
4. "Include Live Activity" はオフでよい
5. 生成された `HomeWidget` ターゲットに App Group を追加（手順1と同じ）

### 3. データの流し方

夜ご飯の判定ロジック（`src/lib/freeTime.ts`）は JS 側にある。これを Swift で書き直すのは
二重管理になるので、**Web 側が判定結果を書き出し、ウィジェットはそれを読むだけ**にする。

```
Web (JS)  --判定結果のJSON-->  App Group の UserDefaults  --読む-->  Widget (Swift)
```

Web から App Group に書くには Capacitor プラグインが必要。
`@capacitor/preferences` に App Group 設定を付けると、そのまま共有領域に書ける。

```bash
npm install @capacitor/preferences
```

`capacitor.config.ts` に追加:

```ts
plugins: {
  Preferences: {
    group: "group.com.keikato.home",
  },
},
```

Web 側で、今日のウィジェット用データを書き出す（アプリ起動時・データ更新時）:

```ts
import { Preferences } from "@capacitor/preferences";

await Preferences.set({
  key: "widget_today",
  value: JSON.stringify({
    date: "2026-07-12",
    dinnerAtHome: true,
    events: [{ time: "18:00", title: "夜ご飯" }],
    todos: ["ゴミ出し", "洗濯"],
  }),
});
```

Swift 側で読む:

```swift
let defaults = UserDefaults(suiteName: "group.com.keikato.home")
let json = defaults?.string(forKey: "widget_today")
```

書き込んだ後はウィジェットの再描画を促す:

```swift
WidgetCenter.shared.reloadAllTimelines()
```

## 配布

### 無料 Apple ID

7日ごとに iPhone を Mac に繋ぎ、Xcode から再インストールする。2台分やる必要がある。

### Apple Developer Program（年 $99）

**TestFlight の Internal Testing なら審査が不要**で、最大 100 人にリンクで配布できる。
2人で使うだけならこれで十分。App Store 公開（＝審査あり）は不要。

```bash
# Xcode で Product → Archive → Distribute App → TestFlight
```

ビルドは 90日で失効するので、3ヶ月に1回 Archive し直す。

## 将来: ソロ / ペアモード（App Store 公開する場合のみ）

一般公開を狙う場合、「2人前提」の設計を解く必要がある。App Store の審査ガイドライン 4.2 は
個人的・限定的な用途のアプリを弾くため、**1人でも成立すること**が必須になる。

設計方針:

- 世帯（household）の仕組みはそのまま使い、**ソロ = メンバー1人の世帯**として扱う
- アカウント作成時に「1人で使う / 2人で使う」を選択
- **後からモード変更可能にする**
  - ソロ → ペア: 招待コードを発行して相手を招く
  - ペア → ソロ: 相手を世帯から外す
- ソロ時は割り勘タブを隠す（him/her の 2人前提が成立しないため）
- 併せて必要: アカウント削除機能、プライバシーポリシー、利用規約、
  審査員用デモアカウント（Google 連携があるため必須）

これらは TestFlight 運用には不要なので、公開を決めた時点で着手する。
