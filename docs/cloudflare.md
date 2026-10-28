# Vercel から Cloudflare Workers への移行

**目的**: ランニングコストを下げる。Vercel の無料プランは非商用に限られ、課金を始めると
Pro（月 $20）が要る。Cloudflare Workers の無料プランは商用利用でき、Imbrex は無料枠に収まる。

## 確認済みのこと（2026-10-28）

| 項目 | 結果 |
|---|---|
| Next.js | 14.2 → **15.5** に上げた（Cloudflare 用のアダプタが 15.5 以上を要求するため。14 は旧世代で、いずれ更新が止まる） |
| 容量 | 圧縮後 **1.3MB**。無料プランの上限 3MB に収まる |
| 実行環境での動作 | Cloudflare の実行環境（workerd）を手元で動かし、全ページ 200、API はログインなしで 401、静的ファイルも配信されることを確認 |
| 暗号化（Google のトークン） | Cloudflare 上でも AES-256-GCM で暗号化・復号できる |
| SSRF 対策 | Cloudflare ではサーバーからの fetch を公開インターネットに限る設定（`global_fetch_strictly_public`）を入れた。手元の確認で、内部のアドレスへの fetch は止まった |

まだ確認できていないこと: 本物の Supabase・Google につないだ状態でのログインと各機能（切り替え後に確認する）。

## やり直さなくてよいもの

ドメイン（`imbrex.app`）が変わらないので、外部の設定はほぼそのまま:

- **Google OAuth**（同意画面・審査・リダイレクト先）… 戻り先は Supabase なので無関係。再審査も不要
- **Supabase** の Redirect URLs（`https://imbrex.app/auth/callback` など）… そのまま
- **Apple でサインイン** … Supabase 経由なので無関係
- **RevenueCat の Webhook**（`https://imbrex.app/api/revenuecat/webhook`）… そのまま
- **iOS アプリ** … `imbrex.app` を読み込んでいるだけなので、作り直しも再提出も不要
- **データ** … 全部 Supabase にあるので、移すものは無い

やることは「Cloudflare にアプリを置く」「環境変数を入れる」「ドメインの向き先を変える」の3つだけ。

## 手順

### 1. Cloudflare にアプリを作る（GitHub とつなぐ）
1. Cloudflare のダッシュボード → **Workers & Pages** → **Create** → **Import a repository**
2. GitHub の `keikato116/home-public` を選ぶ
3. 設定
   - Project name: `imbrex`（`wrangler.jsonc` の name と同じにする）
   - Production branch: `main`
   - Build command: `npx opennextjs-cloudflare build`
   - Deploy command: `npx opennextjs-cloudflare deploy`

### 2. 環境変数を入れる
**Settings → Variables and Secrets**（実行時）と、**Settings → Build → Variables and secrets**（ビルド時）の
両方に入れるものがある。秘密の値は **Secret** の種類で入れる。

| 名前 | ビルド時 | 実行時 | 値の取り方 |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | ✅ | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | ✅ | 同上（anon / publishable key） |
| `SUPABASE_SERVICE_ROLE_KEY` | | ✅ Secret | 同上（service_role / secret key）。`NEXT_PUBLIC_` を付けないこと |
| `GOOGLE_CLIENT_ID` | | ✅ | Google Cloud Console → Google Auth Platform → クライアント |
| `GOOGLE_CLIENT_SECRET` | | ✅ Secret | 同上。表示できなければ「シークレットを追加」で新しく作る（古いものも有効なまま） |
| `TOKEN_ENCRYPTION_KEY` | | ✅ Secret | **Vercel と同じ値**。Vercel で Sensitive にしていて見られない場合は `openssl rand -base64 32` で新しく作る（そのときは、保存済みのトークンが読めなくなるので、2人とも Google カレンダーを1回つなぎ直す） |
| `OPENWEATHER_API_KEY` | | ✅ Secret | OpenWeatherMap のアカウント |
| `ANTHROPIC_API_KEY` | | ✅ Secret | Claude Console → API Keys |
| `NEXT_PUBLIC_BILLING_ENABLED` | ✅ | ✅ | 課金を始めるまでは入れない |
| `NEXT_PUBLIC_REVENUECAT_IOS_API_KEY` | ✅ | ✅ | RevenueCat（課金を始めるとき） |
| `REVENUECAT_WEBHOOK_SECRET` | | ✅ Secret | RevenueCat の Webhook に設定した文字列（課金を始めるとき） |

`NEXT_PUBLIC_` で始まるものは、ビルドの時点で画面のコードに埋め込まれるので、ビルド時にも要る。

入れ終わったら **Deployments → Retry deployment**（または main に何か push）でビルドし直す。

### 3. ドメインを切り替える
**切り替える前に**、Cloudflare の DNS で `imbrex.app` の今のレコード（Vercel を向いている A / CNAME）を
**スクリーンショットに残す**。戻すときに使う。

1. DNS → Records で、`imbrex.app` と `www` の Vercel 向きのレコードを削除
2. Workers & Pages → `imbrex` → Settings → **Domains & Routes** → **Add** → Custom domain → `imbrex.app`
3. 数分で `https://imbrex.app` が Cloudflare から配信される

### 4. 切り替えたら確認
- [ ] `https://imbrex.app/about` が開く
- [ ] Google でログインできる。Apple でもログインできる
- [ ] カレンダーに自分と相手の予定が出る（出なければ Google カレンダーをつなぎ直す）
- [ ] 家事・買い物・割り勘の保存ができる
- [ ] レシピの URL 取り込み・写真取り込みができ、写真が表示される
- [ ] iPhone アプリでも同じように使える

### 戻すとき
Domains & Routes から `imbrex.app` を外し、手順 3 で残したレコードを DNS に戻す。
Vercel のプロジェクトは、1〜2週間問題なく動いてから削除する。

## 開発用のコマンド

```bash
npm run cf:build     # Cloudflare 用にビルド（.open-next/ に出る）
npm run cf:preview   # 手元で Cloudflare の実行環境を使って動かす（.dev.vars に環境変数）
npm run cf:deploy    # 手元から直接デプロイ（ふだんは GitHub 経由で自動）
```
