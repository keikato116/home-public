-- ============================================================
-- サブスクリプション（App Store 課金 / RevenueCat 連携）
-- Supabaseダッシュボード > SQL Editor で実行してください
-- ============================================================

-- RevenueCat の app_user_id は Supabase の user_id を使う（purchases.ts で設定）。
-- 書き込むのは webhook（service role）だけ。クライアントは自分の行を読むだけ。
create table if not exists public.subscriptions (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  product_id  text,
  status      text not null default 'inactive',
    -- active   : 有効（課金中 / 解約予約済みだが期限内）
    -- in_grace : 支払い失敗の猶予期間中（機能は使わせる）
    -- expired  : 期限切れ
    -- inactive : 一度も購入していない
  expires_at  timestamptz,
  environment text,           -- SANDBOX | PRODUCTION
  event_id    text,           -- RevenueCat イベントID（再送の冪等化用）
  updated_at  timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

-- 自分の課金状態だけ読める。書き込みは service role のみ（webhook）。
drop policy if exists "read own subscription" on public.subscriptions;
create policy "read own subscription" on public.subscriptions
  for select using (auth.uid() = user_id);

-- ------------------------------------------------------------
-- 世帯単位の課金判定
-- ------------------------------------------------------------
-- 2人で使う世帯アプリなので、世帯のだれか1人が課金していれば世帯全員が使える。
-- 1人1契約にしたい場合は、この関数の household_members 経由の JOIN を外して
-- s.user_id = auth.uid() だけを見るように変える。
create or replace function public.household_entitled()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.household_members me
    join public.household_members hm on hm.household_id = me.household_id
    join public.subscriptions s on s.user_id = hm.user_id
    where me.user_id = auth.uid()
      and s.status in ('active', 'in_grace')
      and (s.expires_at is null or s.expires_at > now())
  );
$$;

revoke all on function public.household_entitled() from public;
grant execute on function public.household_entitled() to authenticated;

-- ------------------------------------------------------------
-- 有料機能の書き込み制限
-- ------------------------------------------------------------
-- UI でタブを隠すだけでは課金ゲートにならない（WebView / ブラウザから直接
-- Supabase を叩けば書けてしまう）ので、DB 側でも止める。
--
-- restrictive ポリシーは既存の permissive ポリシーと AND されるので、
-- 既存の「世帯メンバーなら操作できる」ポリシーはそのまま残せる。
--
-- select と delete は制限しない。解約後もデータは見えて消せる状態にしておかないと、
-- 「金を払わないと自分のデータを消せない」アプリになってしまう。
drop policy if exists "premium required to insert recipes" on public.recipes;
create policy "premium required to insert recipes"
  on public.recipes as restrictive for insert
  with check (public.household_entitled());

drop policy if exists "premium required to update recipes" on public.recipes;
create policy "premium required to update recipes"
  on public.recipes as restrictive for update
  using (public.household_entitled());

drop policy if exists "premium required to insert meal plans" on public.meal_plans;
create policy "premium required to insert meal plans"
  on public.meal_plans as restrictive for insert
  with check (public.household_entitled());

drop policy if exists "premium required to update meal plans" on public.meal_plans;
create policy "premium required to update meal plans"
  on public.meal_plans as restrictive for update
  using (public.household_entitled());
