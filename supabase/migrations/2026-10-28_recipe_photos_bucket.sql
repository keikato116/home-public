-- ============================================================
-- レシピ写真の置き場所（recipes バケット）を作る
-- Supabaseダッシュボード > SQL Editor で実行してください
-- （2026-10-28_private_recipe_photos.sql の前でも後でもよい）
-- ============================================================
--
-- 公開版の Supabase プロジェクト（2026-09-12 に新規作成）には、このバケットが
-- 作られていなかった。アプリは写真のアップロードに失敗すると写真なしで保存する
-- 作りだったので、それまで写真付きで保存したレシピは、すべて写真なしになっていた。
-- 2026-10-28 に本番で作成済み。新しくプロジェクトを作るときのために残す。
--
-- 非公開。読み書きの範囲は 2026-10-21_security_hardening.sql と
-- 2026-10-28_private_recipe_photos.sql のポリシーが決める。
-- 何度流しても同じ結果になる。

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'recipes', 'recipes', false, 10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/gif']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

select id, public, file_size_limit from storage.buckets where id = 'recipes';
