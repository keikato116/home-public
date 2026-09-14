# iOS アプリ化（公開版）

公開版を App Store に出すまでの手順。個人版の TestFlight 配布とは前提が違うので、
このファイルは公開版（`com.keikato.homeapp`）専用に書き直してある。

## 構成

Capacitor のシェルが、Vercel 上の Next.js を WebView で読み込む。

```
iPhone アプリ（ガワ）
  └─ WKWebView → https://imbrex.app
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

### ✅ 対応済み（2026-09-12）

`src/lib/nativeAuth.ts` に実装した。ネイティブかどうかで自動的に分岐するので、
ブラウザの挙動は変わらない。

```
WebView              Safari                    WebView
signInWithOAuth  →   Google → Supabase  →      appUrlOpen
（URLだけ取る）                                 → exchangeCodeForSession
```

`code_verifier` は WebView 側の cookie にあるので、**コード交換はアプリに戻ってから**行う。
そのため `redirectTo` はサーバーの `/auth/callback` ではなくカスタムスキームを指す。

**ただし、次の2つを設定しないと戻ってこられない。**

1. **Xcode**: App ターゲット → Info → **URL Types** に URL Scheme
   `com.keikato.homeapp` を追加
2. **Supabase**: Authentication → URL Configuration → Redirect URLs に
   `com.keikato.homeapp://auth/callback` を追加

値は `src/lib/constants.ts` の `NATIVE_AUTH_REDIRECT` と一致させること。

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
   - Identifiers → **App IDs** で `com.keikato.homeapp` を作り、
     Capabilities の **Sign in with Apple** にチェック
   - Identifiers → **Services IDs** で `com.keikato.homeapp.signin` を作り、
     Configure から Primary App ID・Domains・Return URLs を設定
     （Return URL は `https://<ref>.supabase.co/auth/v1/callback`）
   - Keys → **Sign in with Apple の鍵（.p8）**
     **.p8 は一度しかダウンロードできない。** Key ID と Team ID も控える

### B. Supabase 側

- Authentication → Providers → **Apple** を有効化

  | 欄 | 入れるもの |
  |---|---|
  | Client IDs | `com.keikato.homeapp,com.keikato.homeapp.signin`（Bundle ID と Services ID をカンマ区切り。名前ではなく識別子） |
  | Secret Key (for OAuth) | **`.p8` の中身ではない。`.p8` で署名した JWT** |

  JWT は `scripts/apple-client-secret.mjs` で作る:

  ```bash
  node scripts/apple-client-secret.mjs \
    --p8 ~/Downloads/AuthKey_XXXXXXXXXX.p8 \
    --team-id XXXXXXXXXX \
    --key-id XXXXXXXXXX \
    --services-id com.keikato.homeapp.signin
  ```

  ⚠️ **この JWT は Apple の仕様で最長6ヶ月。** 切れると Apple ログインが
  全員できなくなる。同じ `.p8` から何度でも作れるので、期限前に同じコマンドを
  実行して貼り替える。**カレンダーに繰り返しの予定を入れておくこと。**
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
# CAP_SERVER_URL=https://imbrex.app を書く
# （capacitor.config.ts が dotenv で .env.local を読む。書き換えたら ios:sync をやり直す）

npm run build
npm run ios:add      # 初回のみ。ios/ が生成される
                     # ※ webDir は capacitor-shell/。Next.js の public/ ではない
                     #   （public/ には index.html が無く、cap add が落ちるため）
npm run ios:sync     # プラグインを追加・更新したら毎回
npm run ios:open     # Xcode が開く
```

**CocoaPods は不要。** Capacitor 8 から Swift Package Manager が既定になっている。

### D. Xcode の設定

1. **App** ターゲット → **Signing & Capabilities**
2. **Team** に Apple Developer のアカウントを選ぶ
3. **Bundle Identifier** が `com.keikato.homeapp` になっているか確認
4. **アプリ名を2か所直す。** `capacitor.config.ts` の `appName` は
   **`cap add ios` でひな型を作るときにしか読まれない**ので、すでに `ios/` が
   ある状態で名前を変えても Xcode 側には反映されない。

   | どこ | 既定値 | 直す値 |
   |---|---|---|
   | General → **Display Name**（`CFBundleDisplayName`） | `home` | `Imbrex` |
   | `Info.plist` の **Bundle name**（`CFBundleName`） | `$(PRODUCT_NAME)` → `App` | `Imbrex` |

   **両方直すこと。** アップロードすると Apple がこの2つを全 App Store の名前と
   突き合わせ、どちらか一方でも既出なら
   `ITMS-90129: The bundle uses a bundle name or display name that is already taken.`
   で弾かれる（実際に踏んだ。`home` も `App` も当然すでに存在する）。

   Build Settings の Product Name を変える方法でも直るが、`.app` のファイル名まで
   変わるので Info.plist を直接書くほうが影響が小さい。

   確認:

   ```bash
   plutil -p ios/App/App/Info.plist | grep -iE 'CFBundleName|CFBundleDisplayName|CFBundleVersion'
   ```
5. **+ Capability** → **Sign in with Apple** を追加
   （これが無いと Apple ログインがネイティブで動かない）
6. iPhone を USB で繋ぎ、上部のデバイス選択から選んで ▶
7. 初回は iPhone 側で 設定 → 一般 → VPN とデバイス管理 から開発者を信頼

### E. 実機で確認すること

| | 見るところ |
|---|---|
| **Google ログイン** | Safari が開いて、終わるとアプリに戻るか。戻らないなら URL Types か Redirect URLs の登録漏れ |
| Apple ログイン | OS の認証シートが出るか |
| 通知 | 設定に **notification 欄が出る**（ブラウザでは出ない）。家事に時刻を入れて翌朝鳴るか |
| セーフエリア | 下タブがホームインジケータに被っていないか |
| 外部リンク | レシピの URL などが Safari で開くか（WebView 内で開くと戻れない） |
| 初回起動 | 「設定が足りません」が出たら `CAP_SERVER_URL` の設定漏れ。直したら **npm run ios:sync をやり直す**（ビルドし直すだけでは反映されない） |

### E-2. アップロードが弾かれたら

**同じビルド番号は二度と受け付けられない。** 中身を直しても Build を上げずに
出し直すと別のエラーになるので、Xcode → App ターゲット → General → **Build** を
必ず1つ進めてから Archive し直す（Version は `1.0` のままでよい）。

Xcode Organizer の **"Uploaded to Apple" は転送が終わっただけ**で、受理された
という意味ではない。検証はそのあとに走り、失敗すると App Store Connect の画面には
何も出ずに **Apple ID 宛のメールだけ**で知らされる。ビルドが TestFlight に
現れないときは、まずメールを見る。

`CAP_SERVER_URL` はネイティブシェルに焼き込まれる。変えたら `npm run ios:sync`
をやり直してから Archive すること。あとから気づくとビルド番号をもう1つ
消費する。

### F. App Store Connect

- アプリを登録（**Bundle ID はここで確定。以後変更不可**）
  - Name: `Imbrex`（ローマ瓦の丸瓦。tegula と対になって継ぎ目を覆う）。
    App Store 全体で一意である必要があるが、**公開前なら変更できる**
  - Primary Language: **日本語**（日本限定配信なので英語にしない）
  - User Access: **Full Access**（Limited にすると、招待した相手にこのアプリを
    見せる許可をここでも別途与える必要が出て二重管理になる）
  - Bundle ID は `com.keikato.homeapp` のまま。アプリ名と揃える必要はない
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
| WebView の Google ログイン | ✅ 実装済み。**Xcode の URL Types と Supabase の Redirect URLs の登録が残り** |
| Sign in with Apple | ⚠️ コードは入った。Apple / Supabase の設定が残り |
| Google OAuth の審査 | ❌ 未対応（独自ドメインが要る。`docs/data-and-privacy.md` 参照） |
| 利用規約・プライバシーポリシー | ⚠️ ドラフト。法的レビュー未実施 |

## ウィジェット

いまは作らない方針。必要になったら WidgetKit のターゲットを足すことになるが、
**Swift で書き直しになり、既存のコードは流用できない**（WebView を表示できないため）。
変更のたびに審査も要る。詳細は判断した時点で書く。
