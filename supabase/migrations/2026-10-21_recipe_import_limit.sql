-- ============================================================
-- レシピ取り込みの上限（1人 月30品）
-- Supabaseダッシュボード > SQL Editor で実行してください
-- ============================================================
--
-- 取り込みは読み取りのたびに Claude の費用がかかる。上限が無いと、使い方によっては
-- 月額の手取りを超えるので、1人あたりで区切る。月の区切りは日本時間。
--
--   count    … 取り込んで保存した品数。利用者に見せる上限（月30品）はこれ
--   analyses … Claude に読ませた回数（写真1枚・URL 1件で1回）。費用の上限を
--              固定するための裏の安全装置（月100回）。保存せずに読み取りだけ
--              繰り返されても、ここで止まる
--
-- 上限の値は /api/parse-recipe と AddRecipeModal が渡す（src/lib/recipeImportLimit.ts）。

create table if not exists public.recipe_import_usage (
  user_id  uuid not null references auth.users(id) on delete cascade,
  month    date not null,              -- その月の1日（日本時間）
  count    integer not null default 0,
  analyses integer not null default 0,
  primary key (user_id, month)
);

-- アプリからは直接読み書きさせない。下の関数経由でだけ扱う。
alter table public.recipe_import_usage enable row level security;

create or replace function public.current_import_month()
returns date
language sql
stable
as $$
  select date_trunc('month', now() at time zone 'Asia/Tokyo')::date;
$$;

-- 読み取りを1回分使う（サーバーだけが呼ぶ）。
--   'ok'       … 使えた
--   'dishes'   … 今月の品数の上限に達している
--   'analyses' … 今月の読み取り回数の上限に達している
-- 同時に呼ばれても上限を超えないよう、増やす条件を同じ文の中で判定する。
create or replace function public.use_recipe_analysis(p_user uuid, p_dish_limit integer, p_analysis_limit integer)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_month date := public.current_import_month();
  v_row public.recipe_import_usage;
begin
  insert into public.recipe_import_usage as u (user_id, month, analyses)
  values (p_user, v_month, 1)
  on conflict (user_id, month) do update
    set analyses = u.analyses + 1
    where u.analyses < p_analysis_limit and u.count < p_dish_limit
  returning u.* into v_row;

  if v_row.user_id is not null then
    return 'ok';
  end if;

  select * into v_row from public.recipe_import_usage where user_id = p_user and month = v_month;
  return case when v_row.count >= p_dish_limit then 'dishes' else 'analyses' end;
end;
$$;

-- 読み取りに失敗した分を戻す（サーバーだけが呼ぶ）
create or replace function public.refund_recipe_analysis(p_user uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.recipe_import_usage
     set analyses = greatest(analyses - 1, 0)
   where user_id = p_user and month = public.current_import_month();
$$;

-- 今月あと何品取り込めるか（本人が呼ぶ）
create or replace function public.recipe_imports_remaining(p_limit integer)
returns integer
language sql
security definer
set search_path = public
stable
as $$
  select greatest(p_limit - coalesce((
    select count from public.recipe_import_usage
    where user_id = auth.uid() and month = public.current_import_month()
  ), 0), 0);
$$;

-- 取り込んだ品を保存したあとに、その品数を記録する（本人が呼ぶ）
create or replace function public.record_recipe_imports(p_count integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if auth.uid() is null or p_count < 1 or p_count > 100 then
    return null;
  end if;
  insert into public.recipe_import_usage as u (user_id, month, count)
  values (auth.uid(), public.current_import_month(), p_count)
  on conflict (user_id, month) do update set count = u.count + p_count
  returning u.count into v_count;
  return v_count;
end;
$$;

-- サーバー専用（任意の利用者を指定できるので、アプリからは呼ばせない）
revoke all on function public.use_recipe_analysis(uuid, integer, integer) from public, anon, authenticated;
revoke all on function public.refund_recipe_analysis(uuid) from public, anon, authenticated;
grant execute on function public.use_recipe_analysis(uuid, integer, integer) to service_role;
grant execute on function public.refund_recipe_analysis(uuid) to service_role;

-- 本人用
revoke all on function public.recipe_imports_remaining(integer) from public, anon;
revoke all on function public.record_recipe_imports(integer) from public, anon;
grant execute on function public.recipe_imports_remaining(integer) to authenticated;
grant execute on function public.record_recipe_imports(integer) to authenticated;
