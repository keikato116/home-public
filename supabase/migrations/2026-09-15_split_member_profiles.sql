-- 同居人からトークンが読めていたのを止める。
--
-- user_tokens には「相手に見せてよいもの」（表示名・カレンダーの色）と
-- 「本人以外に見せてはいけないもの」（Google のトークン）が同居していた。
-- そこに「同じ世帯なら読める」という SELECT ポリシーが付いていたため、
-- 同居人のブラウザから anon キーで
--
--     select google_refresh_token from user_tokens
--
-- が通っていた。RLS は行の制御で列は絞れず、列単位の GRANT も無い。
-- Google のリフレッシュトークンは失効しないので、控えておけば世帯を抜けた
-- あとも相手のカレンダーを読み続けられる。2人で使うアプリとして、これが
-- 一番まずい形の権限漏れだった。
--
-- 対処は暗号化ではない（読める権限がある以上、復号した値を返すことになる）。
-- 見せてよいものを別の表に移し、user_tokens は本人と service_role だけが
-- 読めるようにする。
--
-- 相手のカレンダーは /api/partner-calendar が service_role で取りに行くので、
-- この変更で機能は何も失われない。

begin;

-- ------------------------------------------------------------
-- 相手に見せてよい情報
-- ------------------------------------------------------------

create table if not exists public.member_profiles (
  user_id         uuid primary key references auth.users(id) on delete cascade,
  household_id    uuid references public.households(id) on delete cascade,
  display_name    text not null default '',
  calendar_colors text[],
  updated_at      timestamptz default now()
);

-- 既存の値を移す。user_tokens に行がある人だけが対象で、
-- 行が無い人（Apple だけで入った人）は名前を入れた時点で作られる。
insert into public.member_profiles (user_id, household_id, display_name, calendar_colors, updated_at)
select user_id, household_id, coalesce(display_name, ''), calendar_colors, coalesce(updated_at, now())
from public.user_tokens
on conflict (user_id) do nothing;

alter table public.member_profiles enable row level security;

create policy "user can manage own profile"
  on public.member_profiles for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- 名前と色は相手に見えてよい。ここが唯一の「同居人が読める」経路になる。
create policy "household members can read profiles"
  on public.member_profiles for select
  using (
    exists (
      select 1
      from public.household_members hm1
      join public.household_members hm2 on hm1.household_id = hm2.household_id
      where hm1.user_id = auth.uid() and hm2.user_id = member_profiles.user_id
    )
  );

grant all on public.member_profiles to anon, authenticated, service_role;

-- ------------------------------------------------------------
-- トークンは本人と service_role だけ
-- ------------------------------------------------------------

-- これが穴だったポリシー。"user can manage own token"（user_id = auth.uid()）は
-- 残るので、本人は引き続き自分の行を読み書きできる。service_role は RLS を
-- 迂回するので /api/partner-calendar は影響を受けない。
drop policy if exists "household members can read tokens" on public.user_tokens;

-- 移した列は user_tokens から外す。残すと二重管理になり、どちらが正か
-- 分からなくなる。値は上で member_profiles にコピー済み。
alter table public.user_tokens drop column if exists display_name;
alter table public.user_tokens drop column if exists calendar_colors;

commit;

-- ------------------------------------------------------------
-- 確認
-- ------------------------------------------------------------
-- 4行とも true になること。
--
--   select
--     (select count(*) from public.member_profiles) > 0            as profiles_copied,
--     not exists (
--       select 1 from pg_policies
--       where tablename = 'user_tokens' and policyname = 'household members can read tokens'
--     )                                                             as leak_policy_gone,
--     not exists (
--       select 1 from information_schema.columns
--       where table_name = 'user_tokens' and column_name = 'display_name'
--     )                                                             as columns_moved,
--     exists (
--       select 1 from pg_policies
--       where tablename = 'member_profiles' and policyname = 'household members can read profiles'
--     )                                                             as profile_policy_present;
