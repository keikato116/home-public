-- ============================================================
-- レシピ写真を非公開にする
-- Supabaseダッシュボード > SQL Editor で実行してください
-- （アプリのデプロイ後に流す。先に流すと、デプロイまで写真が表示されない）
-- ============================================================
--
-- これまでは公開バケットで、URL を知っていればだれでも見られた。
-- 非公開にして、見られるのを持ち主と、同じ世帯にいる間の相手だけにする。
-- アプリは表示のたびに期限つき（1時間）の URL を発行する（src/lib/recipePhotos.ts）。
--
-- 読める写真:
--   - 自分のフォルダ（{自分の user_id}/…）
--   - 同じ世帯の相手のフォルダ（{相手の user_id}/…）。世帯を抜ければ見えなくなる
--   - 以前の保存先だった、自分の世帯のフォルダ（{household_id}/…）
-- 書き込み・上書き・削除は、これまでどおり自分のフォルダだけ。

update storage.buckets set public = false where id = 'recipes';

-- フォルダ名が uuid でなければ false（cast で落ちないように）
create or replace function public.can_read_recipe_photo_folder(folder text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select case
    when folder is null or folder !~ '^[0-9a-fA-F-]{36}$' then false
    else folder = auth.uid()::text
      or public.shares_household_with(folder::uuid)
      or public.is_household_member(folder::uuid)
  end;
$$;

revoke all on function public.can_read_recipe_photo_folder(text) from public, anon;
grant execute on function public.can_read_recipe_photo_folder(text) to authenticated;

drop policy if exists "recipes: read own folder" on storage.objects;
drop policy if exists "recipes: read own or partner folder" on storage.objects;
create policy "recipes: read own or partner folder" on storage.objects
  for select to authenticated
  using (bucket_id = 'recipes' and public.can_read_recipe_photo_folder((storage.foldername(name))[1]));

-- 確認: public が false、読み取りのポリシーが1つ
select id, public from storage.buckets where id = 'recipes';
select policyname, cmd from pg_policies
where schemaname = 'storage' and tablename = 'objects' and policyname like 'recipes:%'
order by policyname;
