-- ============================================================
-- 割り勘の固定費（通信・電気・ガス・水道など、月ごとに金額が変わるもの）
-- Supabaseダッシュボード > SQL Editor で実行してください
-- ============================================================
--
--   split_utilities        … 項目の定義（名前・どちらが払うか）。世帯の設定なので部屋をまたぐ
--   split_utility_amounts  … 各月の金額。お金の記録なので「いまの部屋」の分だけ見せる
--
-- 元の個人版の 02_split_utilities.sql に、公開版のルールを足したもの:
--   - 金額は部屋（ペアの期間）で区切る（2026-09-11_pairing_scope.sql と同じ形）
--   - 書き込みは加入者だけ（2026-10-21_all_features_paid.sql と同じ形）
--   - 金額の行が、別の世帯の項目を指せないようにする
--   - 月ごとの金額は関数経由で書く（相手が入れ替わった月に書けない不具合の修正。下記）
-- 何度流しても同じ結果になる。

create table if not exists public.split_utilities (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid references public.households(id) on delete cascade not null,
  name         text not null,
  card         text not null default 'mine' check (card in ('mine', 'family')),
  created_at   timestamptz default now()
);

create table if not exists public.split_utility_amounts (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid references public.households(id) on delete cascade not null,
  utility_id   uuid references public.split_utilities(id) on delete cascade not null,
  year         integer not null,
  month        integer not null check (month between 1 and 12),
  amount       integer not null check (amount >= 0),
  -- 部屋の区切りに使う。金額を書き直したときもアプリが now() に更新する
  created_at   timestamptz not null default now(),
  unique (utility_id, year, month)
);

alter table public.split_utilities enable row level security;
alter table public.split_utility_amounts enable row level security;

-- 世帯のメンバーだけ
drop policy if exists "household members can manage split utilities" on public.split_utilities;
create policy "household members can manage split utilities"
  on public.split_utilities for all
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

-- 世帯のメンバーだけ。加えて、指している項目が同じ世帯のものであること
drop policy if exists "household members can manage split utility amounts" on public.split_utility_amounts;
create policy "household members can manage split utility amounts"
  on public.split_utility_amounts for all
  using (public.is_household_member(household_id))
  with check (
    public.is_household_member(household_id)
    and exists (
      select 1 from public.split_utilities u
      where u.id = split_utility_amounts.utility_id
        and u.household_id = split_utility_amounts.household_id
    )
  );

-- 金額は、いまの部屋で書いたものだけ見せる
drop policy if exists "current pairing only" on public.split_utility_amounts;
create policy "current pairing only" on public.split_utility_amounts
  as restrictive for select
  using (
    created_at >= (select h.pairing_started_at from public.households h where h.id = split_utility_amounts.household_id)
  );

-- 書き込みは加入者だけ（select と delete は絞らない）
do $do$
declare
  t text;
begin
  foreach t in array array['split_utilities', 'split_utility_amounts'] loop
    execute format('drop policy if exists "premium required to insert %s" on public.%I', t, t);
    execute format(
      'create policy "premium required to insert %s" on public.%I as restrictive for insert with check (public.household_entitled())',
      t, t
    );
    execute format('drop policy if exists "premium required to update %s" on public.%I', t, t);
    execute format(
      'create policy "premium required to update %s" on public.%I as restrictive for update using (public.household_entitled())',
      t, t
    );
  end loop;
end
$do$;

-- 既存の世帯に既定の項目を入れる（まだ項目が無い世帯だけ）。
-- 新しく作られる世帯には /api/household/create が入れる。
insert into public.split_utilities (household_id, name, created_at)
select h.id, d.name, now() + (d.ord || ' milliseconds')::interval
from public.households h
cross join (values (1, '通信'), (2, '電気'), (3, 'ガス'), (4, '水道')) as d(ord, name)
where not exists (
  select 1 from public.split_utilities u where u.household_id = h.id
);

-- ------------------------------------------------------------
-- 月ごとの金額の書き込み口（固定費とカード請求）
-- ------------------------------------------------------------
-- 相手が入れ替わると、前の部屋で入れた同じ月の行は "current pairing only" で
-- 見えなくなる。そこへクライアントから upsert すると、見えない行に当たって
-- RLS で拒否され、新しいペアはその月の金額を一切入れられなかった
-- （family_card_totals では以前から起きていた不具合。2026-10-28 に再現して確認）。
--
-- 見えない行はクライアントからは消すことも上書きすることもできないので、
-- 書き込みはこの関数に通す。呼んだ人がその世帯のメンバーで、加入していることを
-- 確かめてから、前の部屋の行を今の部屋の行として上書きする。

create or replace function public.set_family_card_total(
  p_household uuid, p_year integer, p_month integer, p_total integer
)
returns public.family_card_totals
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.family_card_totals;
begin
  if not public.is_household_member(p_household) then
    raise exception 'not a member of this household';
  end if;
  if not public.household_entitled() then
    raise exception 'premium required';
  end if;
  insert into public.family_card_totals as f (household_id, year, month, total, created_at)
  values (p_household, p_year, p_month, p_total, now())
  on conflict (household_id, year, month) do update
    set total = excluded.total, created_at = now()
  returning f.* into v_row;
  return v_row;
end;
$$;

-- p_amount が null ならその月の入力を消す
create or replace function public.set_split_utility_amount(
  p_utility uuid, p_year integer, p_month integer, p_amount integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_household uuid;
begin
  select household_id into v_household from public.split_utilities where id = p_utility;
  if v_household is null or not public.is_household_member(v_household) then
    raise exception 'not a member of this household';
  end if;
  if not public.household_entitled() then
    raise exception 'premium required';
  end if;
  if p_amount is null then
    delete from public.split_utility_amounts
     where utility_id = p_utility and year = p_year and month = p_month;
    return;
  end if;
  insert into public.split_utility_amounts as a (household_id, utility_id, year, month, amount, created_at)
  values (v_household, p_utility, p_year, p_month, p_amount, now())
  on conflict (utility_id, year, month) do update
    set amount = excluded.amount, created_at = now();
end;
$$;

revoke all on function public.set_family_card_total(uuid, integer, integer, integer) from public, anon;
revoke all on function public.set_split_utility_amount(uuid, integer, integer, integer) from public, anon;
grant execute on function public.set_family_card_total(uuid, integer, integer, integer) to authenticated;
grant execute on function public.set_split_utility_amount(uuid, integer, integer, integer) to authenticated;

-- 確認: 7 行（項目 3 + 金額 4 … 世帯メンバー / 部屋 / 加入者の各ポリシー）
select tablename, policyname from pg_policies
where tablename in ('split_utilities', 'split_utility_amounts')
order by tablename, policyname;
