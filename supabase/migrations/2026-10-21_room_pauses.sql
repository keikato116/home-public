-- ============================================================
-- 課金切れによる自動退出と、同じ相手が戻ったときの部屋の再開
-- Supabaseダッシュボード > SQL Editor で実行してください
-- （2026-10-21_premium_grants.sql のあとに）
-- ============================================================
--
-- 2人で使う世帯で片方の課金が切れると、切れた人が自動で世帯から抜ける
-- （src/lib/server/lapseExit.ts、RevenueCat の webhook から呼ぶ）。
-- データは世帯に残す。
--
-- ふつうはメンバーが入れ替わると新しい部屋になり（pairing_started_at が now() に
-- なる）、割り勘と共有の買い物リストは前の部屋の分が見えなくなる。
-- 抜けた人が同じ招待コードで戻ってきたときだけは、元の部屋の開始時刻に戻して
-- 前の記録を見えるようにする。そのために、抜けた時点の開始時刻をここに控える。
--
-- 抜けているあいだに別の人が入った場合は、控えを捨てる（部屋が別物になったので、
-- 戻ってきた人にその間の記録を見せてはいけない）。

create table if not exists public.room_pauses (
  household_id       uuid not null references public.households(id) on delete cascade,
  user_id            uuid not null references auth.users(id) on delete cascade,
  pairing_started_at timestamptz not null,   -- 抜けた時点の部屋の開始時刻
  paused_at          timestamptz not null default now(),
  primary key (household_id, user_id)
);

-- service role（webhook と /api/household/join）だけが触る。ポリシーは作らない。
alter table public.room_pauses enable row level security;

-- 課金切れで抜けた本人に、戻るための招待コードを見せる。
-- 抜けた人は元のメンバーなので、コードを知っていて問題ない。
-- 戻った・相手が別の人を入れた・世帯が消えた、のどれでも控えが消えて null になる。
create or replace function public.my_paused_room()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select h.invite_code
  from public.room_pauses p
  join public.households h on h.id = p.household_id
  where p.user_id = auth.uid()
  order by p.paused_at desc
  limit 1;
$$;

revoke all on function public.my_paused_room() from public, anon;
grant execute on function public.my_paused_room() to authenticated;
