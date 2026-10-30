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

Vercel だけに頼っていた箇所は1つだけで、直してある: 天気の位置を Vercel が付けるヘッダー
（`x-vercel-ip-latitude`）から取っていた。Cloudflare では `request.cf` の位置を使う（両方で動く）。

### Vercel を消してよい時期
- `imbrex.app` を Cloudflare に切り替えて、1〜2週間問題なく使えている
- 2人の iPhone に、`imbrex.app` を読み込むビルド（Build 5 以降）が入っている
  （それより前のビルドは `home-public.vercel.app` を読み込んでいるので、Vercel を消すと真っ白になる）

そのとき、Supabase の Redirect URLs の `vercel.app` の行も消す。

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
   - Project name: `home-public`（`wrangler.jsonc` の name と同じにする。違うとビルドが失敗する）
   - Production branch: `main`
   - Build command: 空欄
   - Deploy command: `npm run cf:deploy`（Cloudflare 用にビルドしてからデプロイする。
     `opennextjs-cloudflare deploy` だけだと、ビルドしていないので
     「Could not find compiled Open Next config」で失敗する）

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

### 2.5 切り替える前に workers.dev でログインまで試す
Supabase → Authentication → URL Configuration
- **Site URL** を `https://imbrex.app` にする（`vercel.app` のままだと、許可されていない戻り先は
  全部 Vercel に戻される）
- **Redirect URLs** に `https://home-public.〇〇.workers.dev/**` を足す（〇〇 はアドレスバーのとおり）

これで `workers.dev` の URL でもログインでき、本物のデータで動作を確かめられる。
切り替えが済んだら、この行は消してよい。

### 3. ドメインを切り替える
**切り替える前に**、Cloudflare の DNS で `imbrex.app` の今のレコード（Vercel を向いている A / CNAME）を
**スクリーンショットに残す**。戻すときに使う。

1. DNS → Records で、`imbrex.app` と `www` の Vercel 向きのレコードを削除
2. Workers & Pages → `home-public` → Settings → **Domains & Routes** → **Add** → Custom domain → `imbrex.app`
3. 数分で `https://imbrex.app` が Cloudflare から配信される

### 4. 切り替えたら確認
- [ ] `https://imbrex.app/about` が開く
- [ ] Google でログインできる。Apple でもログインできる
- [ ] カレンダーに自分と相手の予定が出る（出なければ Google カレンダーをつなぎ直す）
- [ ] 家事・買い物・割り勘の保存ができる
- [ ] レシピの URL 取り込み・写真取り込みができ、写真が表示される
- [ ] iPhone アプリでも同じように使える

### 戻すとき
Domains & Routes から `imbrex.app` と `www.imbrex.app` を外し、DNS に次の2行を作り直す
（2026-10-30 の切り替え前の値。Proxy は DNS only）。

| Name | Type | Content |
|---|---|---|
| `imbrex.app` | CNAME | `0fd98a7a440893c2.vercel-dns-017.com` |
| `www` | CNAME | `0fd98a7a440893c2.vercel-dns-017.com` |

TXT（`google-site-verification=…`）は Google のドメイン所有確認なので、切り替えでも消さない。
Vercel のプロジェクトは、1〜2週間問題なく動いてから削除する。

## 開発用のコマンド

```bash
npm run cf:build     # Cloudflare 用にビルド（.open-next/ に出る）
npm run cf:preview   # 手元で Cloudflare の実行環境を使って動かす（.dev.vars に環境変数）
npm run cf:deploy    # 手元から直接デプロイ（ふだんは GitHub 経由で自動）
```
