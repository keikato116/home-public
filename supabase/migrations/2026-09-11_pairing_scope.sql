-- ============================================================
-- 「部屋」（ペアの期間）でデータの見える範囲を区切る
-- Supabaseダッシュボード > SQL Editor で実行してください
-- ============================================================
--
-- 同じ世帯でも、2人の組み合わせが変わればそれは別の部屋。
-- 割り勘と共有の買い物リストは、いま一緒にいる相手との記録だけを見せる。
--
--   割り勘 / 共有の買い物リスト … いまの部屋で書いたものだけ表示
--   レシピ                      … 部屋をまたいで引き継ぐ
--   自分だけの買い物アイテム      … 部屋をまたいで引き継ぐ
--
-- これがないと、解散や相手のアカウント削除で1人に戻ったあと、
-- 次に別の人を招待した瞬間に、前の相手とのお金の記録が
-- 新しい相手の画面に出てしまう（割り勘タブが再表示されるため）。

-- ------------------------------------------------------------
-- 1. いまの部屋がいつ始まったか
-- ------------------------------------------------------------
alter table public.households
  add column if not exists pairing_started_at timestamptz;

-- 既存の世帯は、世帯を作った時刻を部屋の開始とみなす。
-- now() にすると、いま入っている割り勘データが一斉に見えなくなる。
update public.households
   set pairing_started_at = coalesce(created_at, now())
 where pairing_started_at is null;

alter table public.households alter column pairing_started_at set default now();
alter table public.households alter column pairing_started_at set not null;

-- ------------------------------------------------------------
-- 2. 判定に使う created_at を保証する
-- ------------------------------------------------------------
-- ダッシュボードで作った表に created_at が無いと判定できないので、無ければ足す。
alter table public.split_sessions      add column if not exists created_at timestamptz not null default now();
alter table public.split_subscriptions add column if not exists created_at timestamptz not null default now();
alter table public.family_card_totals  add column if not exists created_at timestamptz not null default now();
alter table public.shopping_items      add column if not exists created_at timestamptz default now();

-- ------------------------------------------------------------
-- 3. メンバーが増減したら、その時点で新しい部屋にする
-- ------------------------------------------------------------
-- 参加・解散・アカウント削除（cascade 削除）のどの経路でも効くよう、
-- アプリ側ではなくトリガーで面倒を見る。
create or replace function public.bump_pairing_started_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.households
     set pairing_started_at = now()
   where id = coalesce(new.household_id, old.household_id);
  return null;  -- after trigger なので戻り値は使われない
end;
$$;

drop trigger if exists household_members_pairing_bump on public.household_members;
create trigger household_members_pairing_bump
  after insert or delete on public.household_members
  for each row execute function public.bump_pairing_started_at();

-- ------------------------------------------------------------
-- 4. いまの部屋の分だけ見せる
-- ------------------------------------------------------------
-- restrictive なので既存のポリシー（世帯メンバーなら操作できる）と AND される。
-- select だけ絞る。書き込みは常に「いま」なので条件を満たす。
-- created_at が null の行を隠さないよう coalesce しておく。

drop policy if exists "current pairing only" on public.split_sessions;
create policy "current pairing only" on public.split_sessions
  as restrictive for select
  using (
    coalesce(created_at, 'epoch'::timestamptz)
      >= (select h.pairing_started_at from public.households h where h.id = split_sessions.household_id)
  );

drop policy if exists "current pairing only" on public.split_subscriptions;
create policy "current pairing only" on public.split_subscriptions
  as restrictive for select
  using (
    coalesce(created_at, 'epoch'::timestamptz)
      >= (select h.pairing_started_at from public.households h where h.id = split_subscriptions.household_id)
  );

drop policy if exists "current pairing only" on public.family_card_totals;
create policy "current pairing only" on public.family_card_totals
  as restrictive for select
  using (
    coalesce(created_at, 'epoch'::timestamptz)
      >= (select h.pairing_started_at from public.households h where h.id = family_card_totals.household_id)
  );

-- 買い物リストは共有アイテムだけ絞る。
-- 自分だけのアイテム（user_id が入っている）は部屋をまたいで持ち越す。
drop policy if exists "current pairing only for shared items" on public.shopping_items;
create policy "current pairing only for shared items" on public.shopping_items
  as restrictive for select
  using (
    user_id is not null
    or coalesce(created_at, 'epoch'::timestamptz)
         >= (select h.pairing_started_at from public.households h where h.id = shopping_items.household_id)
  );

-- 確認: 4つの表で RLS が有効になっていること（false があると上のポリシーは効かない）
--   select relname, relrowsecurity from pg_class
--   where relname in ('split_sessions','split_subscriptions','family_card_totals','shopping_items');
