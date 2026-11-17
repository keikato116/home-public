-- ============================================================
-- 世帯への参加を承認制にする・招待コードを使い捨てにする
-- Supabaseダッシュボード > SQL Editor で実行してください
-- （2026-10-21_room_pauses.sql のあとに）
-- ============================================================
--
-- これまでは招待コードを知っていれば、1人で使っている世帯に断りなく入れた。
-- コードは一生変わらないので、解散した元の相手や、コードを偶然知った人が
-- 勝手に入り、相手の予定（Google カレンダー）や共有のデータを見られた。
--
-- これからは:
--   ・コードを入れると「参加の申請」になり、世帯の人が承認したときだけ入る
--   ・コードは、だれかが入った・抜けたたびに作り直す（設定から手でも作り直せる）
--   ・課金切れで抜けた人は、コードではなくアカウントで見分けて「前の部屋に戻る申請」
--     を出せる。承認されると元の記録が戻る（room_pauses）
--   ・コードの総当たりを防ぐため、申請の回数を数える
--
-- どの表も service role（/api/household/*）だけが触る。クライアント向けのポリシーは作らない。

-- 参加の申請。1人が同時に出せる申請は1つ（出し直すと上書き）。
create table if not exists public.join_requests (
  requester_id uuid primary key references auth.users(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  created_at   timestamptz not null default now()
);
create index if not exists join_requests_household_idx on public.join_requests (household_id);
alter table public.join_requests enable row level security;

-- コードを試した記録（回数制限用）。古いものは API が消す。
create table if not exists public.join_attempts (
  user_id      uuid not null references auth.users(id) on delete cascade,
  attempted_at timestamptz not null default now()
);
create index if not exists join_attempts_user_idx on public.join_attempts (user_id, attempted_at);
alter table public.join_attempts enable row level security;

-- 招待コードを作り直して返す。形は今までと同じ（16進8桁を大文字）。
create or replace function public.rotate_invite_code(p_household uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v text;
begin
  loop
    v := upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    begin
      update public.households set invite_code = v where id = p_household;
      return v;
    exception when unique_violation then
      -- まれに他の世帯と重なったら引き直す
    end;
  end loop;
end;
$$;

revoke all on function public.rotate_invite_code(uuid) from public, anon, authenticated;
grant execute on function public.rotate_invite_code(uuid) to service_role;

-- 課金切れで抜けた本人に「前の部屋」を知らせる。以前は招待コードを返していたが、
-- コードは作り直されるので、残っている人の表示名を返す（戻る申請はアカウントで行う）。
-- 前の部屋が無い（戻った・別の人が入った・世帯が消えた）ときは null。
-- 残っている人が名前を付けていなければ空文字。
create or replace function public.my_paused_room()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (select mp.display_name
       from public.household_members hm
       left join public.member_profiles mp on mp.user_id = hm.user_id
      where hm.household_id = p.household_id
      limit 1),
    '')
  from public.room_pauses p
  where p.user_id = auth.uid()
  order by p.paused_at desc
  limit 1;
$$;

revoke all on function public.my_paused_room() from public, anon;
grant execute on function public.my_paused_room() to authenticated;

-- 確認:
--   select to_regclass('public.join_requests'), to_regclass('public.join_attempts');
--   select has_function_privilege('authenticated', 'public.rotate_invite_code(uuid)', 'execute');  -- false
