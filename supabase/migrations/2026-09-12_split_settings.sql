-- ============================================================
-- 割り勘の設定（締め日・負担比率）を世帯で共有する
--
-- それまで localStorage に置いていたため、端末を変えると初期値に戻り、
-- 2人のあいだでも値がずれていた。割り勘の計算そのものが変わる設定なので、
-- 「同じ世帯なら同じ値」でなければ精算が合わない。
--
-- 記録のほう（split_sessions / split_subscriptions / family_card_totals）は
-- 最初から Supabase にある。ここで移すのは設定だけ。
--
-- households に列を足さなかった理由:
--   households には「ログイン済みなら誰でも引ける」select ポリシーがある
--   （招待コードで参加するために必要）。そこに金額の設定を置くと、
--   無関係な利用者にも読めてしまう。calendar_settings と同じ形の別表にする。
-- ============================================================

create table if not exists public.split_settings (
  household_id uuid primary key references public.households(id) on delete cascade,
  -- 0 = 暦月、1-28 = その日を締め日とする請求サイクル
  closing_day  integer not null default 0 check (closing_day between 0 and 28),
  -- 相手の負担比率（0.0-1.0）。既定は折半
  her_ratio    double precision not null default 0.5 check (her_ratio between 0 and 1),
  updated_at   timestamptz default now()
);

alter table public.split_settings enable row level security;

drop policy if exists "household members can manage split settings" on public.split_settings;
create policy "household members can manage split settings"
  on public.split_settings for all
  using (
    exists (select 1 from public.household_members hm
            where hm.household_id = split_settings.household_id and hm.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.household_members hm
            where hm.household_id = split_settings.household_id and hm.user_id = auth.uid())
  );

grant all on public.split_settings to anon, authenticated, service_role;

-- 確認: 1行返れば成功
select
  (select count(*) from pg_class
     where relnamespace = 'public'::regnamespace and relname = 'split_settings') as 表,
  (select count(*) from pg_policies
     where schemaname = 'public' and tablename = 'split_settings')               as ポリシー;
