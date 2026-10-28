# 公開までのチェックリスト（2026-10-28 時点）

上から順に進める。順番を入れ替えると、自分たちが使えなくなるものがある（⚠️）。

## 済んでいること
- Supabase: `security_hardening` / `premium_grants` / `room_pauses` / `all_features_paid` を適用、運営2人に付与
- App Store Connect: 有料App契約・口座・税務（W-8BEN）・DSA がすべて Active
- Google OAuth の審査: 承認済み（同意画面の設定は変えないこと）

## 1. Supabase（写真の非公開化と recipes バケットは 2026-10-28 に適用を確認。ほかは結果を確認すること）
1. Authentication → Sign In / Providers → **Allow manual linking をオン**
   （Apple で登録した人が Google カレンダーを繋ぐのに必要）
2. SQL Editor で順に流す
   1. `supabase/migrations/2026-10-21_recipe_import_limit.sql`
   2. `supabase/migrations/2026-10-21_recipe_steps.sql`
   3. `supabase/migrations/2026-10-28_split_utilities.sql`
   4. `supabase/migrations/2026-10-28_private_recipe_photos.sql`
      （⚠️ Vercel の最新デプロイが終わってから。先に流すとデプロイまで写真が出ない）
3. 審査用アカウントに付与されているか確認し、無ければ付与する
   ```sql
   select u.email, g.note from public.premium_grants g join auth.users u on u.id = g.user_id;
   select public.grant_premium('imbrextest@gmail.com', null, '審査用');
   ```

## 2. Vercel
4. `ANTHROPIC_API_KEY` を追加して Redeploy
5. レシピの取り込みを試す（大手レシピサイトの URL、ブログの URL、写真）。
   精度が足りなければ Haiku から Sonnet 5.5 に戻す（`src/app/api/parse-recipe/route.ts`）

## 3. App Store Connect（商品）
6. Small Business Program の承認を確認
7. サブスクリプショングループと商品を作る（中身は `docs/app-store-listing.md`）
   - 月額300円、導入オファー「無料・1か月・日本」、表示名と説明
   - 審査用スクリーンショットは手順 11 のあとで撮って入れる

## 4. RevenueCat
8. プロジェクトを作り、App Store と接続
9. Entitlement `premium`、Offering `default` に月額の商品を入れる
10. Webhook: URL `https://imbrex.app/api/revenuecat/webhook`、Authorization に任意の秘密の文字列

## 5. Vercel（課金をオンにする）
11. ⚠️ 先に手順 3（付与）が済んでいること。付与の無い人はアプリを開くと加入画面しか出なくなる
    - `NEXT_PUBLIC_REVENUECAT_IOS_API_KEY`（RevenueCat の `appl_` で始まる公開キー）
    - `REVENUECAT_WEBHOOK_SECRET`（手順 10 と同じ文字列）
    - `NEXT_PUBLIC_BILLING_ENABLED=true`
    - Redeploy

## 6. Xcode（Build 5）
12. `.env.local` に `CAP_SERVER_URL=https://imbrex.app` → `npm run ios:sync` → `npm run ios:open`
13. Signing & Capabilities に **In-App Purchase** を追加、Build を 5 に
14. Product → Archive → App Store Connect にアップロード

## 7. 実機で確認（Sandbox）
15. App Store Connect → ユーザとアクセス → Sandbox テスターを作り、iPhone の
    設定 → App Store → Sandbox アカウントでサインイン
16. 確認すること
    - [ ] 新しいアカウントで登録すると加入画面が出て、「最初の1か月無料」と表示される
    - [ ] 加入するとすべての機能が使える。購入の復元も効く
    - [ ] 招待コードで参加: 加入済み同士なら入れる。未加入なら加入画面のあと自動で参加する
    - [ ] 片方の購読を期限切れにすると、その人が自動で抜けて、もう1人はソロで使い続けられる。
          加入し直して同じ招待コードで戻ると、割り勘の記録が戻る
    - [ ] Apple でログイン → ホームの案内から Google カレンダーを連携しても、同じアカウントのまま
    - [ ] レシピの写真が表示される（非公開化のあと）。相手の写真も見える
    - [ ] 固定費を入れると精算額に反映される
    - [ ] アカウント削除ができる（加入中なら解約の案内が先に出る）
17. 購入画面のスクリーンショットを撮って、手順 7 の商品に入れる

## 8. 提出
18. スクリーンショット 6.9インチ・6.5インチ（Simulator の iPhone 16 Pro Max / 11 Pro Max で ⌘S）
19. 概要・キーワード・URL・App のプライバシー・審査メモを入れる（`docs/app-store-listing.md`）
20. 年齢制限 4+、カテゴリ ライフスタイル、価格は無料、**配信は日本のみ**
21. ⚠️ バージョンのページで、サブスク商品を「App内課金とサブスクリプション」に追加する
22. 審査メモの `imbrextest@gmail.com` のパスワードが現在のものか確認して提出

## 公開後
- 有料の利用者が付いたら、または保存・転送が無料枠の7割を超えたら Supabase を Pro に
- 解約の様子を見て、年額プランを足すか決める
