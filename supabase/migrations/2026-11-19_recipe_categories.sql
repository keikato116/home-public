-- ============================================================
-- レシピの分類を、世帯ごとに自分たちで作れるようにする（2段まで）
-- Supabaseダッシュボード > SQL Editor で実行してください
-- ============================================================
--
-- これまで分類はアプリに固定（main・side… と main の下の meat・fish・others）だった。
-- これからは世帯（2人）で共有する分類の一覧を持ち、追加・名前の変更・削除・並べ替えができる。
--
--   ・2段まで: 上の分類（parent_id が null）と、その下の分類
--   ・レシピは今までどおり分類の「名前」（recipes.category / subcategory）を持つ。
--     名前を変える・消すときは、下の関数で世帯のレシピもまとめて書き換える
--     （表を直接書き換えるとレシピと食い違うので、名前の更新と削除はアプリから直接はできない）
--   ・最初は今までの分類を入れておく。preset_key は元の役割（献立のガチャが
--     「主菜」「副菜」などを見分けるのに使う）。名前を変えても残る
--   ・一度入れた世帯には二度と入れない（全部消したのに勝手に戻らないように）

alter table public.households add column if not exists recipe_categories_seeded_at timestamptz;

create table if not exists public.recipe_categories (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  parent_id    uuid references public.recipe_categories(id) on delete cascade,
  name         text not null check (char_length(btrim(name)) between 1 and 20),
  preset_key   text,
  position     integer not null default 0,
  created_at   timestamptz not null default now()
);

-- 同じ階層に同じ名前は作らない（大文字・小文字は区別しない）
create unique index if not exists recipe_categories_unique_name
  on public.recipe_categories (household_id, coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(btrim(name)));
create index if not exists recipe_categories_household_idx on public.recipe_categories (household_id);

-- 2段まで・親と同じ世帯・1世帯あたりの数の上限
create or replace function public.check_recipe_category()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  parent record;
begin
  new.name := btrim(new.name);
  if new.parent_id is not null then
    select household_id, parent_id into parent from public.recipe_categories where id = new.parent_id;
    if parent is null or parent.household_id <> new.household_id then
      raise exception 'parent category not found' using errcode = '23503';
    end if;
    if parent.parent_id is not null then
      raise exception 'categories can only be two levels deep' using errcode = '23514';
    end if;
  end if;
  if tg_op = 'INSERT' and (select count(*) from public.recipe_categories where household_id = new.household_id) >= 100 then
    raise exception 'too many categories' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists check_recipe_category on public.recipe_categories;
create trigger check_recipe_category
  before insert or update on public.recipe_categories
  for each row execute function public.check_recipe_category();

alter table public.recipe_categories enable row level security;

drop policy if exists "members can read recipe categories" on public.recipe_categories;
create policy "members can read recipe categories" on public.recipe_categories
  for select using (public.is_household_member(household_id));

drop policy if exists "members can add recipe categories" on public.recipe_categories;
create policy "members can add recipe categories" on public.recipe_categories
  for insert with check (public.is_household_member(household_id));

drop policy if exists "members can reorder recipe categories" on public.recipe_categories;
create policy "members can reorder recipe categories" on public.recipe_categories
  for update using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

-- 有料の機能（ほかの表と同じ課金ゲート）
drop policy if exists "premium required to insert recipe_categories" on public.recipe_categories;
create policy "premium required to insert recipe_categories" on public.recipe_categories
  as restrictive for insert with check (public.household_entitled());
drop policy if exists "premium required to update recipe_categories" on public.recipe_categories;
create policy "premium required to update recipe_categories" on public.recipe_categories
  as restrictive for update using (public.household_entitled());

-- アプリから直接変えてよいのは並び順だけ。名前の変更と削除は下の関数で行う。
revoke update, delete on public.recipe_categories from anon, authenticated;
grant update (position) on public.recipe_categories to authenticated;

-- ------------------------------------------------------------
-- 最初の分類を入れる
-- ------------------------------------------------------------
create or replace function public.seed_recipe_categories(p_household uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  names text[] := array['main', 'side', 'soup', 'rice & bowl', 'pasta', 'noodles', 'dessert', 'seasonal', 'bento'];
  subs  text[] := array['meat', 'fish', 'others'];
  main_id uuid;
  i integer;
begin
  for i in 1 .. array_length(names, 1) loop
    insert into public.recipe_categories (household_id, name, preset_key, position)
    values (p_household, names[i], names[i], i)
    on conflict do nothing;
  end loop;
  select id into main_id from public.recipe_categories
   where household_id = p_household and parent_id is null and preset_key = 'main';
  if main_id is not null then
    for i in 1 .. array_length(subs, 1) loop
      insert into public.recipe_categories (household_id, parent_id, name, preset_key, position)
      values (p_household, main_id, subs[i], subs[i], i)
      on conflict do nothing;
    end loop;
  end if;
  update public.households set recipe_categories_seeded_at = now() where id = p_household;
end;
$$;

revoke all on function public.seed_recipe_categories(uuid) from public, anon, authenticated;

-- アプリがレシピの画面を開くときに呼ぶ。まだ一度も入れていない世帯にだけ入れる。
create or replace function public.ensure_recipe_categories()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  hid uuid;
begin
  select household_id into hid from public.household_members where user_id = auth.uid() limit 1;
  if hid is null then return; end if;
  perform pg_advisory_xact_lock(hashtext('recipe_categories:' || hid::text));
  if (select recipe_categories_seeded_at from public.households where id = hid) is not null then return; end if;
  perform public.seed_recipe_categories(hid);
end;
$$;

revoke all on function public.ensure_recipe_categories() from public, anon;
grant execute on function public.ensure_recipe_categories() to authenticated;

-- ------------------------------------------------------------
-- 名前の変更・削除（世帯のレシピも一緒に書き換える）
-- ------------------------------------------------------------
create or replace function public.rename_recipe_category(p_id uuid, p_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  c record;
  parent_name text;
  new_name text := btrim(coalesce(p_name, ''));
begin
  select * into c from public.recipe_categories where id = p_id;
  if c is null or not public.is_household_member(c.household_id) then
    raise exception 'category not found' using errcode = 'P0002';
  end if;
  if not public.household_entitled() then
    raise exception 'subscription required' using errcode = '42501';
  end if;
  if char_length(new_name) not between 1 and 20 then
    raise exception 'invalid name' using errcode = '22023';
  end if;
  if new_name = c.name then return; end if;

  update public.recipe_categories set name = new_name where id = p_id;

  if c.parent_id is null then
    update public.recipes set category = new_name
     where category = c.name
       and owner_id in (select user_id from public.household_members where household_id = c.household_id);
  else
    select name into parent_name from public.recipe_categories where id = c.parent_id;
    update public.recipes set subcategory = new_name
     where category = parent_name and subcategory = c.name
       and owner_id in (select user_id from public.household_members where household_id = c.household_id);
  end if;
end;
$$;

revoke all on function public.rename_recipe_category(uuid, text) from public, anon;
grant execute on function public.rename_recipe_category(uuid, text) to authenticated;

-- 消した分類のレシピは消さずに「未分類」へ。上の分類を消すと、その下の分類も消える。
create or replace function public.delete_recipe_category(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  c record;
  parent_name text;
begin
  select * into c from public.recipe_categories where id = p_id;
  if c is null or not public.is_household_member(c.household_id) then
    raise exception 'category not found' using errcode = 'P0002';
  end if;
  if not public.household_entitled() then
    raise exception 'subscription required' using errcode = '42501';
  end if;

  if c.parent_id is null then
    update public.recipes set category = null, subcategory = null
     where category = c.name
       and owner_id in (select user_id from public.household_members where household_id = c.household_id);
  else
    select name into parent_name from public.recipe_categories where id = c.parent_id;
    update public.recipes set subcategory = null
     where category = parent_name and subcategory = c.name
       and owner_id in (select user_id from public.household_members where household_id = c.household_id);
  end if;

  delete from public.recipe_categories where id = p_id;
end;
$$;

revoke all on function public.delete_recipe_category(uuid) from public, anon;
grant execute on function public.delete_recipe_category(uuid) to authenticated;

-- ------------------------------------------------------------
-- いまある世帯に、最初の分類を入れておく
-- ------------------------------------------------------------
do $$
declare
  h record;
begin
  for h in select id from public.households where recipe_categories_seeded_at is null loop
    perform public.seed_recipe_categories(h.id);
  end loop;
end;
$$;

-- 確認:
--   select count(*) from public.recipe_categories;                       -- 世帯の数 × 12
--   select count(*) from public.households where recipe_categories_seeded_at is null;  -- 0
