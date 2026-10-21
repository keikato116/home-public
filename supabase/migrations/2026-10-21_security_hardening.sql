-- ============================================================
-- 個人データへのアクセスを締める
-- Supabaseダッシュボード > SQL Editor で実行してください
-- （課金の有無に関係なく、アプリをデプロイしたらすぐ流す）
-- ============================================================
--
-- 2026-10-21 の監査で見つかった穴をまとめて塞ぐ。何度流しても同じ結果になる。
-- 最後の確認クエリの結果を見て、ここに書いていないポリシーが残っていないか確かめること。

-- ------------------------------------------------------------
-- 1. 他人の世帯に勝手に入れた
-- ------------------------------------------------------------
-- ログインしている人ならだれでも、全世帯の id と招待コードを読めて
-- （"authenticated can lookup household"）、どの世帯にでも自分を追加できた
-- （"user can insert own membership"）。招待されていない世帯に入り込んで、
-- その世帯のデータと相手の Google カレンダーを見られた。定員と課金の確認もすり抜けた。
-- 世帯の作成と参加はサーバー（/api/household/create, join）が service role で行う。
drop policy if exists "authenticated can lookup household" on public.households;
drop policy if exists "authenticated users can create household" on public.households;
drop policy if exists "user can insert own membership" on public.household_members;

-- ------------------------------------------------------------
-- 2. Google の鍵の表をクライアントから書けた
-- ------------------------------------------------------------
-- 本人の行だけとはいえ household_id を自由に書けたので、他人の世帯を指す行を作れた。
-- 読み書きはすべてサーバー（/api/tokens、暗号化つき）を通るので、クライアントには何も許さない。
drop policy if exists "user can manage own token" on public.user_tokens;

-- ------------------------------------------------------------
-- 3. 相手のレシピの持ち主を書き換えられた
-- ------------------------------------------------------------
-- 「作った回数」のために相手のレシピも更新できるが、owner_id まで変えられた
-- （相手のレシピを自分のものにできた）。RLS では変更前の値を見られないのでトリガーで止める。
create or replace function public.keep_recipe_owner()
returns trigger
language plpgsql
set search_path = public
as $fn$
begin
  if new.owner_id is distinct from old.owner_id then
    raise exception 'recipes.owner_id は変更できません';
  end if;
  return new;
end;
$fn$;

drop trigger if exists recipes_keep_owner on public.recipes;
create trigger recipes_keep_owner
  before update on public.recipes
  for each row execute function public.keep_recipe_owner();

-- ------------------------------------------------------------
-- 4. レシピ写真のストレージ
-- ------------------------------------------------------------
-- ポリシーがダッシュボードで手作業で作られていて、リポジトリに無かった。
-- 他人の写真の上書き・削除や、ファイル一覧の列挙ができる設定になっていても気づけない。
-- recipes バケットに関するポリシーを一度すべて外し、「自分のフォルダ（{user_id}/...）だけ」にする。
--
-- 写真の表示は公開 URL で行う（バケットは public のまま）。URL を知っていれば見られるのは
-- プライバシーポリシーに書いてあるとおり。一覧の取得は自分のフォルダしかできないので、
-- 他人の写真の URL を探し出すことはできない。
do $do$
declare
  p record;
begin
  for p in
    select policyname from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and (coalesce(qual, '') ilike '%recipes%' or coalesce(with_check, '') ilike '%recipes%')
  loop
    execute format('drop policy %I on storage.objects', p.policyname);
  end loop;
end
$do$;

create policy "recipes: read own folder" on storage.objects
  for select to authenticated
  using (bucket_id = 'recipes' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "recipes: upload to own folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'recipes' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "recipes: update own folder" on storage.objects
  for update to authenticated
  using (bucket_id = 'recipes' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'recipes' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "recipes: delete own folder" on storage.objects
  for delete to authenticated
  using (bucket_id = 'recipes' and (storage.foldername(name))[1] = auth.uid()::text);

-- 画像以外や巨大なファイルを置かせない
update storage.buckets
   set file_size_limit = 10485760,  -- 10MB
       allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/gif']
 where id = 'recipes';

-- ------------------------------------------------------------
-- 確認: いま有効なポリシーの一覧
-- ------------------------------------------------------------
-- 期待どおりなら、
--   households        : "member can read household" だけ
--   household_members : "member can read memberships" だけ
--   user_tokens       : 何も無い
--   storage.objects   : 上の4つ（ほかのバケットを作っていなければ）
-- それ以外のものがあれば、ダッシュボードで作られた古いポリシーなので確認すること。
select schemaname, tablename, policyname, cmd, roles, permissive
from pg_policies
where schemaname in ('public', 'storage')
order by schemaname, tablename, policyname;
