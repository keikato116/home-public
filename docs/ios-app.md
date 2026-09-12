# iOS アプリ化（公開版）

公開版を App Store に出すまでの手順。個人版の TestFlight 配布とは前提が違うので、
このファイルは公開版（`com.keikato.homeapp`）専用に書き直してある。

## 構成

Capacitor のシェルが、Vercel 上の Next.js を WebView で読み込む。

```
iPhone アプリ（ガワ）
  └─ WKWebView → https://home-public.vercel.app
                    └─ Supabase（データ・認証）
```

アプリ自体は画面を持たない。**Web を直せば `git push` だけで全員に届く**のが利点で、
Xcode でのビルドが要るのはネイティブ側（プラグイン・capability）を触ったときだけ。

---

## ⚠️ 先に知っておくこと: WebView では Google ログインが通らない

**これが公開版いちばんの壁。** 2023年2月から、Google は WKWebView のような
埋め込みブラウザからの OAuth を `disallowed_useragent` で拒否している。
Capacitor の WebView はまさにそれなので、**いまのコードのまま iOS で
「sign in with google」を押すと 403 になる。**

ブラウザで動いていても、アプリでは動かない。ここは必ず踏む。

### 直し方

認証だけ**端末の Safari（SFSafariViewController）に出して**、終わったら
ディープリンクでアプリに戻す。Google の規約上もこれが正しい形。

```bash
npm install @capacitor/browser @capacitor/app
```

流れ:

1. `supabase.auth.signInWithOAuth({ skipBrowserRedirect: true })` で URL だけ受け取る
2. `Browser.open({ url })` で Safari に出す
3. 認証後、カスタムスキーム（`com.keikato.homeapp://`）または Universal Link で戻る
4. `App.addListener("appUrlOpen", ...)` で受けて `exchangeCodeForSession` する

**PKCE の落とし穴**: Supabase は `code_verifier` を WebView 側の storage に置く。
Safari 側でコード交換をしてしまうと verifier が無くて失敗するので、
**交換は必ずアプリ（WebView）側に戻ってから**行う。

### Sign in with Apple は別扱いにできる

ネイティブのプラグインを使えば Safari を経由せず、OS の認証シートで完結する。
Google より素直なので、**iOS では Apple を主、Google を従にする**のが現実的。

---

## 手順

### A. Apple 側（先に済ませる）

1. **Apple Developer Program に加入**（年 $99）。App Store 公開には必須
2. **Bundle ID を確定する** — 現在 `com.keikato.homeapp`
   **App Store Connect にアプリを登録したあとは二度と変えられない。**
   アプリ名を変えるなら、登録する前に決めきること
3. Sign in with Apple 用に
   - Identifiers → **Services ID** を作る
   - Return URL に `https://<ref>.supabase.co/auth/v1/callback`
   - Keys → **Sign in with Apple の鍵（.p8）**。Key ID と Team ID を控える

### B. Supabase 側

- Authentication → Providers → **Apple** を有効化（A-3 の値を入れる）
- Authentication → **Manual linking を有効化**
  （Apple で入った人が後から Google カレンダーを繋ぐのに使う）
- 未適用のマイグレーションを流す
  - `supabase/migrations/2026-09-12_chore_notify_time.sql`
  - `supabase/migrations/2026-09-12_split_settings.sql`

### C. Mac での作業

```bash
git clone https://github.com/keikato116/home-public.git
cd home-public
npm install

cp .env.local.example .env.local
# CAP_SERVER_URL=https://home-public.vercel.app を書く（これが無いと真っ白になる）

npm run build
npm run ios:add      # 初回のみ。ios/ が生成される
npm run ios:sync     # プラグインを追加・更新したら毎回
npm run ios:open     # Xcode が開く
```

**CocoaPods は不要。** Capacitor 8 から Swift Package Manager が既定になっている。

### D. Xcode の設定

1. **App** ターゲット → **Signing & Capabilities**
2. **Team** に Apple Developer のアカウントを選ぶ
3. **Bundle Identifier** が `com.keikato.homeapp` になっているか確認
4. **+ Capability** → **Sign in with Apple** を追加
   （これが無いと Apple ログインがネイティブで動かない）
5. iPhone を USB で繋ぎ、上部のデバイス選択から選んで ▶
6. 初回は iPhone 側で 設定 → 一般 → VPN とデバイス管理 から開発者を信頼

### E. 実機で確認すること

| | 見るところ |
|---|---|
| **Google ログイン** | **まず落ちる**（上記の WebView 問題）。Safari 経由に直してから再確認 |
| Apple ログイン | OS の認証シートが出るか |
| 通知 | 設定に **notification 欄が出る**（ブラウザでは出ない）。家事に時刻を入れて翌朝鳴るか |
| セーフエリア | 下タブがホームインジケータに被っていないか |
| 外部リンク | レシピの URL などが Safari で開くか（WebView 内で開くと戻れない） |
| 初回起動 | `CAP_SERVER_URL` が正しいか。白画面ならここ |

### F. App Store Connect

- アプリを登録（**Bundle ID はここで確定。以後変更不可**）
- スクリーンショット **2サイズ**（6.9インチ / 6.5インチ）
- **App プライバシー申告** — `docs/data-and-privacy.md` の「外部に出るデータ」がそのまま材料
- サポート URL、プライバシーポリシー URL（`/privacy`）
- 審査メモに書くこと
  - デモ用アカウント（**Google ログインがあるので必須**）
  - レシピと献立は課金未実装のため非表示であること
  - 割り勘は2人目が参加すると表示されること（ソロでは出ない）

---

## 残っている審査ブロッカー

| | 状態 |
|---|---|
| WebView の Google ログイン | ❌ **未対応。iOS で確実に落ちる** |
| Sign in with Apple | ⚠️ コードは入った。Apple / Supabase の設定が残り |
| Google OAuth の審査 | ❌ 未対応（独自ドメインが要る。`docs/data-and-privacy.md` 参照） |
| 利用規約・プライバシーポリシー | ⚠️ ドラフト。法的レビュー未実施 |

## ウィジェット

いまは作らない方針。必要になったら WidgetKit のターゲットを足すことになるが、
**Swift で書き直しになり、既存のコードは流用できない**（WebView を表示できないため）。
変更のたびに審査も要る。詳細は判断した時点で書く。
