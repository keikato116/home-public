-- ============================================================
-- レシピを「世帯のもの」から「その人のもの」に変える
--
-- それまでレシピは household_id に紐づいていて、解散のたびに
-- 抜ける側へ全件を複製していた。結果として:
--   ・解散のたびに行が倍になる（利用者が増えるほど効く）
--   ・写真は複製されないので、複製の thumbnail_url が
--     元の世帯のファイルを指したままになる。元を消すと写真が消える
--   ・相手が1人の時期に入れたレシピまで、別れたあと永久に手元に残る
--
-- 持ち主を人にすれば、複製そのものが要らなくなる。
--   ・自分のレシピは常に自分のもの
--   ・同じ世帯にいる間だけ、お互いのレシピが見える
--   ・別れたら、それぞれ自分の分だけが残る（複製も削除も発生しない）
--
-- 献立は世帯のものなので変えない。相手のレシピを指した献立は、
-- 別れると参照先が見えなくなるが、meal_plans.label に料理名が
-- 入っているので表示は崩れない。
-- ============================================================

-- ------------------------------------------------------------
-- 1. 持ち主の列を足して埋める
-- ------------------------------------------------------------

alter table public.recipes
  add column if not exists owner_id uuid references auth.users(id) on delete cascade;

-- 作成者が分かるものはそれを持ち主にする
update public.recipes
   set owner_id = created_by
 where owner_id is null and created_by is not null;

-- 作成者が分からないもの（過去の複製など）は、その世帯を作った人のものにする
update public.recipes r
   set owner_id = (
     select hm.user_id
       from public.household_members hm
      where hm.household_id = r.household_id
      order by hm.joined_at
      limit 1
   )
 where r.owner_id is null;

-- 世帯に誰もいない（＝誰にも見えない）レシピは、この機会に消す
delete from public.recipes where owner_id is null;

alter table public.recipes alter column owner_id set not null;

-- ------------------------------------------------------------
-- 2. 世帯との縁を切る
-- ------------------------------------------------------------
-- household_id には on delete cascade が付いている。持ち主が世帯を
-- 移ったり、空になった世帯が消えたりするとレシピまで消えてしまうので外す。
--
-- 古いポリシーが household_id を参照しているので、列より先に落とす。
-- 残したまま drop column すると 2BP01 で止まる。

drop policy if exists "household members can manage recipes" on public.recipes;

alter table public.recipes drop column if exists household_id;

-- created_by は持ち主と同じ意味になるので落とす
alter table public.recipes drop column if exists created_by;

-- ------------------------------------------------------------
-- 3. 「同じ世帯にいるか」を判定する関数
-- ------------------------------------------------------------
-- ポリシーの中で household_members を引くと再帰するので、
-- security definer で RLS を迂回する。

create or replace function public.shares_household_with(other_user uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.household_members me
    join public.household_members other
      on other.household_id = me.household_id
    where me.user_id = auth.uid()
      and other.user_id = other_user
  );
$$;

revoke all on function public.shares_household_with(uuid) from public;
grant execute on function public.shares_household_with(uuid) to authenticated;

-- ------------------------------------------------------------
-- 4. ポリシーを貼り直す
-- ------------------------------------------------------------

drop policy if exists "owner or partner can read recipes" on public.recipes;
drop policy if exists "owner can insert recipes" on public.recipes;
drop policy if exists "owner or partner can update recipes" on public.recipes;
drop policy if exists "owner can delete recipes" on public.recipes;

-- 読む: 自分のもの、または同じ世帯にいる人のもの
create policy "owner or partner can read recipes"
  on public.recipes for select
  using (owner_id = auth.uid() or public.shares_household_with(owner_id));

-- 足す: 自分のものとしてのみ
create policy "owner can insert recipes"
  on public.recipes for insert
  with check (owner_id = auth.uid());

-- 直す: 同じ世帯なら相手のものも直せる
-- （「作った回数」を2人のどちらからでも増やせる必要があるため）
create policy "owner or partner can update recipes"
  on public.recipes for update
  using (owner_id = auth.uid() or public.shares_household_with(owner_id))
  with check (owner_id = auth.uid() or public.shares_household_with(owner_id));

-- 消す: 持ち主だけ。相手のレシピを消せると、別れたあとに取り返しがつかない
create policy "owner can delete recipes"
  on public.recipes for delete
  using (owner_id = auth.uid());

-- 確認: owner_id が not null で、household_id が消えていて、ポリシーが4本
select
  (select count(*) from information_schema.columns
     where table_name='recipes' and column_name='owner_id' and is_nullable='NO')      as 持ち主の列,
  (select count(*) from information_schema.columns
     where table_name='recipes' and column_name='household_id')                       as 世帯の列,
  (select count(*) from pg_policies
     where schemaname='public' and tablename='recipes')                               as ポリシー数;
