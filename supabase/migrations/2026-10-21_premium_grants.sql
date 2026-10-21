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
-- 一切読み書きできない。付与の有無は premium_status() 経由でだけ本人に伝わる。
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
-- 有料機能の判定
-- ------------------------------------------------------------
-- **2人で使う場合は、2人とも権利を持っていないと使えない。**
-- 権利は1人ずつ持つ（App Store で購入しているか、運営が付与しているか）。
-- 世帯の全員が権利を持っているときだけ、その世帯で有料機能が開く。
-- 1人世帯なら本人だけを見る。
--
-- 結果として、1人で加入していた人が相手を招待すると、相手が加入するまで
-- 有料機能は使えなくなる（データは消えない。閲覧と削除はできる）。

-- 1人分の権利。だれの分でも引けるので、アプリからは呼ばせない
-- （下の関数は security definer なので、中からは呼べる）。
create or replace function public.member_premium_source(p_user uuid)
returns text
language sql
security definer
set search_path = public
stable
as $$
  select case
    when exists (
      select 1 from public.subscriptions s
      where s.user_id = p_user
        -- 手入力の付与は premium_grants に移してある。ここで拾うと「購入」扱いになり、
        -- 払っていない人に解約を求めてしまう。
        and s.product_id is distinct from 'manual_grant'
        and s.status in ('active', 'in_grace')
        and (s.expires_at is null or s.expires_at > now())
    ) then 'subscription'
    when exists (
      select 1 from public.premium_grants g
      where g.user_id = p_user
        and (g.expires_at is null or g.expires_at > now())
    ) then 'grant'
    else null
  end;
$$;

revoke all on function public.member_premium_source(uuid) from public, anon, authenticated;

-- 自分の権利: 'subscription'（購入） / 'grant'（付与） / null
create or replace function public.premium_source()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select public.member_premium_source(auth.uid());
$$;

revoke all on function public.premium_source() from public, anon;
grant execute on function public.premium_source() to authenticated;

-- 世帯で有料機能が開いているか。RLS の課金ゲートが見る関数。
create or replace function public.household_entitled()
returns boolean
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
    select auth.uid()   -- 世帯に入る前は本人だけ
  )
  select auth.uid() is not null
     and not exists (
       select 1 from mates where public.member_premium_source(mates.user_id) is null
     );
$$;

revoke all on function public.household_entitled() from public, anon;
grant execute on function public.household_entitled() to authenticated;

-- 画面用にまとめて返す。
--   own           : 自分の権利（上の premium_source と同じ）
--   partner_ready : 自分以外の世帯メンバーが全員権利を持っているか（1人なら true）
--   entitled      : 世帯で有料機能が開いているか（household_entitled と同じ）
-- 「自分は加入済みだが相手待ち」「相手は加入済み」を出し分けるのに使う。
-- 相手について分かるのは、権利があるかどうかだけ（購入か付与かは見せない）。
create or replace function public.premium_status()
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select jsonb_build_object(
    'own', public.premium_source(),
    'partner_ready', not exists (
      select 1
      from public.household_members me
      join public.household_members hm on hm.household_id = me.household_id
      where me.user_id = auth.uid()
        and hm.user_id <> auth.uid()
        and public.member_premium_source(hm.user_id) is null
    ),
    'entitled', public.household_entitled()
  );
$$;

revoke all on function public.premium_status() from public, anon;
grant execute on function public.premium_status() to authenticated;

-- ------------------------------------------------------------
-- 運営用: 付与と取り消し
-- ------------------------------------------------------------
-- 付与は1人ずつ。2人で使っている世帯なら、2人とも付与しないと使えない。
--
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
