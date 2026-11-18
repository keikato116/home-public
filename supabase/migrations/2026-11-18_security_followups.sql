-- ============================================================
-- セキュリティの手直し（2026-11-18）
-- Supabaseダッシュボード > SQL Editor で実行してください
-- ============================================================
--
-- レシピの元のページの URL（recipes.url）は、取り込みのときにサーバーが入れるが、
-- 持ち主（と同じ世帯の相手）はデータベースに直接書き換えられる。
-- javascript: や data: の URL を入れられると、相手が「元のページを開く」を押したときに
-- 危ない動きをしうるので、http / https だけを受け付ける。
-- 画面の側でも同じことを確かめている（src/lib/recipeSteps.ts の safeExternalUrl）。
--
-- NOT VALID: すでにある行は確かめない（取り込みで入ったものは http / https のはず）。
-- これから書く行と、書き換える行にだけ効く。

alter table public.recipes drop constraint if exists recipes_url_http;
alter table public.recipes
  add constraint recipes_url_http
  check (url is null or url ~* '^https?://')
  not valid;

-- 確認: 既存の行に http / https 以外が無いか（0 なら問題なし）
--   select count(*) from public.recipes where url is not null and url !~* '^https?://';
