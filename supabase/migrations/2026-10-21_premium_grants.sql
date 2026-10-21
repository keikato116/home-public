-- ============================================================
-- 運営による有料機能の付与
-- Supabaseダッシュボード > SQL Editor で実行してください
-- ============================================================
--
-- 特定のユーザーに、App Store で買わなくても有料機能を使わせるための仕組み
-- （自分たち・審査用アカウント・知り合いなど）。
--
-- subscriptions とは別のテーブルにしている。subscriptions は RevenueCat の
-- webhook が user_id 単位で丸ごと上書きするので、そこに手で入れた行は、
-- その人が一度でも購入→解約すると EXPIRATION で expired に書き換わって消える。
--
-- 付与・取り消しは下の grant_premium() / revoke_premium() を SQL Editor から呼ぶ。
-- アプリ（anon / authenticated）からは呼べない。

create table if not exists public.premium_grants (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  expires_at timestamptz,          -- null = 無期限
  note       text,                 -- だれに・なぜ付与したかのメモ
  granted_at timestamptz not null default now()
);

-- ポリシーは作らない。RLS が有効でポリシーが無いので、anon / authenticated からは
-- 一切読み書きできない。付与の有無は premium_source() 経由でだけ本人に伝わる。
alter table public.premium_grants enable row level security;

-- 以前の手順（docs/app-store.md）で subscriptions に手で入れた付与を移す。
-- そのまま置いておくと、その人が購入→解約したときに webhook に上書きされて消える。
-- 元の行は残す（webhook が来れば普通に上書きされるだけで、害は無い）。
insert into public.premium_grants (user_id, expires_at, note)
select user_id, expires_at, 'subscriptions の manual_grant から移行'
from public.subscriptions
where product_id = 'manual_grant'
on conflict (user_id) do nothing;

-- ------------------------------------------------------------
-- 有料機能がなぜ使えるか
-- ------------------------------------------------------------
-- 'subscription' : 本人が App Store で購入している
-- 'grant'        : 本人に運営が付与している
-- 'household'    : 世帯のもう1人が購入 or 付与されている
-- null           : 使えない
--
-- 画面の出し分けに使う。たとえば解約の案内は 'subscription' の人にだけ要る
-- （付与されている人や、相手の契約で使っている人に「解約して」と言っても意味が無い）。
create or replace function public.premium_source()
returns text
language sql
security definer
set search_path = public
stable
as $$
  with mates as (
    select hm.user_id
    from public.household_members me
    join public.household_members hm on hm.household_id = me.household_id
    where me.user_id = auth.uid()
    union
    -- 世帯に入る前でも、本人の購入・付与は効くようにする
    select auth.uid()
  ),
  paid as (
    select s.user_id from public.subscriptions s
    where s.user_id in (select user_id from mates)
      and s.status in ('active', 'in_grace')
      and (s.expires_at is null or s.expires_at > now())
  ),
  granted as (
    select g.user_id from public.premium_grants g
    where g.user_id in (select user_id from mates)
      and (g.expires_at is null or g.expires_at > now())
  )
  select case
    when exists (select 1 from paid    where user_id = auth.uid()) then 'subscription'
    when exists (select 1 from granted where user_id = auth.uid()) then 'grant'
    when exists (select 1 from paid) or exists (select 1 from granted) then 'household'
    else null
  end;
$$;

revoke all on function public.premium_source() from public, anon;
grant execute on function public.premium_source() to authenticated;

-- RLS の課金ゲートが見る関数。判定を premium_source() に一本化して、
-- 画面の表示と書き込みの可否が食い違わないようにする。
create or replace function public.household_entitled()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.premium_source() is not null;
$$;

revoke all on function public.household_entitled() from public, anon;
grant execute on function public.household_entitled() to authenticated;

-- ------------------------------------------------------------
-- 運営用: 付与と取り消し
-- ------------------------------------------------------------
-- 例:
--   select public.grant_premium('someone@example.com');                         -- 無期限
--   select public.grant_premium('someone@example.com', now() + interval '3 months', '友人');
--   select public.revoke_premium('someone@example.com');
--
-- 一覧:
--   select u.email, g.expires_at, g.note, g.granted_at
--   from public.premium_grants g join auth.users u on u.id = g.user_id
--   order by g.granted_at desc;

create or replace function public.grant_premium(
  p_email text,
  p_until timestamptz default null,
  p_note  text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid;
begin
  select id into v_user from auth.users where lower(email) = lower(trim(p_email));
  if v_user is null then
    raise exception 'ユーザーが見つかりません: %（先にアプリで一度ログインしてもらう必要があります）', p_email;
  end if;

  insert into public.premium_grants (user_id, expires_at, note)
  values (v_user, p_until, p_note)
  on conflict (user_id) do update
    set expires_at = excluded.expires_at,
        note       = coalesce(excluded.note, public.premium_grants.note),
        granted_at = now();

  return format('付与しました: %s（期限: %s）', trim(p_email), coalesce(p_until::text, '無期限'));
end;
$$;

create or replace function public.revoke_premium(p_email text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  delete from public.premium_grants g
  using auth.users u
  where u.id = g.user_id and lower(u.email) = lower(trim(p_email));
  get diagnostics v_count = row_count;
  if v_count = 0 then
    return format('付与されていません: %s', trim(p_email));
  end if;
  return format('取り消しました: %s', trim(p_email));
end;
$$;

-- Supabase は public スキーマの関数に、既定で anon / authenticated の実行権を付ける。
-- public から外すだけでは残るので、名指しで外す。これを忘れると、ログインした
-- だれもが自分に有料機能を付与できてしまう。
revoke all on function public.grant_premium(text, timestamptz, text) from public, anon, authenticated;
revoke all on function public.revoke_premium(text) from public, anon, authenticated;
