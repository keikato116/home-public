# home（App Store 公開版）

2人暮らしの家事・予定・食事をまとめる iOS アプリ。
内輪用の [home](https://github.com/keikato116/Home) をベースに、App Store 公開向けに分けたリポジトリ。

内輪版との違い:

- **レシピ機能と献立カレンダーが月額サブスク対象**（未購入だとタブごと出ない）
- RevenueCat 経由の App Store 課金と、Supabase 側での課金判定
- **ソロモード** — 1人でも使える。1人のあいだは割り勘タブを隠す
- **アカウント削除** — 設定から完結する
- 利用規約 / プライバシーポリシーのページ
- Bundle ID が別（`com.keikato.homeapp`）

## 構成

- Next.js 14（App Router）+ TypeScript + Tailwind
- Supabase（認証・DB・Storage）
- Capacitor — ネイティブシェルが Vercel 上の Web アプリを WebView で読む
- RevenueCat — App Store 課金

Web を直せば `git push` だけでアプリに反映される。Xcode の再ビルドが要るのは
ネイティブ側（プラグイン追加など）を触ったときだけ。

## 開発

```bash
npm install
cp .env.local.example .env.local   # 値を埋める
npm run dev
```

| コマンド | 内容 |
|---|---|
| `npm run dev` | 開発サーバー |
| `npm run build` | 本番ビルド |
| `npm run lint` | ESLint |
| `npm test` | Vitest |
| `npm run ios:sync` / `ios:open` | Capacitor 同期 / Xcode を開く |

## ドキュメント

- [docs/app-store.md](docs/app-store.md) — 課金の仕組み、RevenueCat と App Store Connect の設定、審査までの残作業
- [docs/ios-app.md](docs/ios-app.md) — iOS アプリ化とウィジェット
- [REFACTORING_PLAN.md](REFACTORING_PLAN.md) — リファクタ計画

## DB

`supabase/schema.sql` を実行したあと、`supabase/migrations/` を日付順に適用する。
課金まわりは `2026-09-11_subscriptions.sql`。
