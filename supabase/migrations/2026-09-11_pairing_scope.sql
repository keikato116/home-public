-- ============================================================
-- 「部屋」（ペアの期間）でデータの見える範囲を区切る
-- Supabaseダッシュボード > SQL Editor に、このファイルの中身を貼って実行
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
--
-- 何度流しても同じ結果になる。表が見つからない場合はその表だけ飛ばして
-- NOTICE を出すので、Results の隣の Logs / Messages を見ること。

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
-- 2. メンバーが増減したら、その時点で新しい部屋にする
-- ------------------------------------------------------------
-- 参加・解散・アカウント削除（cascade 削除）のどの経路でも効くよう、
-- アプリ側ではなくトリガーで面倒を見る。
create or replace function public.bump_pairing_started_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  update public.households
     set pairing_started_at = now()
   where id = coalesce(new.household_id, old.household_id);
  return null;  -- after trigger なので戻り値は使われない
end;
$fn$;

drop trigger if exists household_members_pairing_bump on public.household_members;
create trigger household_members_pairing_bump
  after insert or delete on public.household_members
  for each row execute function public.bump_pairing_started_at();

-- ------------------------------------------------------------
-- 3. いまの部屋の分だけ見せる（割り勘の3表）
-- ------------------------------------------------------------
-- restrictive なので既存のポリシー（世帯メンバーなら操作できる）と AND される。
-- select だけ絞る。書き込みは常に「いま」なので条件を満たす。
do $do$
declare
  t text;
  rls boolean;
begin
  foreach t in array array['split_sessions', 'split_subscriptions', 'family_card_totals'] loop
    if to_regclass('public.' || t) is null then
      raise notice 'スキップ: public.% という表がありません', t;
      continue;
    end if;

    -- 判定に使う created_at が無ければ足す
    execute format(
      'alter table public.%I add column if not exists created_at timestamptz not null default now()', t
    );

    execute format('drop policy if exists "current pairing only" on public.%I', t);
    execute format($pol$
      create policy "current pairing only" on public.%I
        as restrictive for select
        using (
          coalesce(created_at, 'epoch'::timestamptz)
            >= (select h.pairing_started_at from public.households h where h.id = %I.household_id)
        )
    $pol$, t, t);

    select relrowsecurity into rls from pg_class where oid = to_regclass('public.' || t);
    if not rls then
      raise notice '要確認: public.% は RLS が無効なので、このポリシーは効きません', t;
    end if;
  end loop;
end
$do$;

-- ------------------------------------------------------------
-- 4. 買い物リスト（共有アイテムだけ絞る）
-- ------------------------------------------------------------
-- 自分だけのアイテム（user_id が入っている）は部屋をまたいで持ち越す。
do $do$
declare
  rls boolean;
begin
  if to_regclass('public.shopping_items') is null then
    raise notice 'スキップ: public.shopping_items という表がありません';
    return;
  end if;

  alter table public.shopping_items add column if not exists created_at timestamptz default now();

  drop policy if exists "current pairing only for shared items" on public.shopping_items;
  create policy "current pairing only for shared items" on public.shopping_items
    as restrictive for select
    using (
      user_id is not null
      or coalesce(created_at, 'epoch'::timestamptz)
           >= (select h.pairing_started_at from public.households h where h.id = shopping_items.household_id)
    );

  select relrowsecurity into rls from pg_class where oid = to_regclass('public.shopping_items');
  if not rls then
    raise notice '要確認: public.shopping_items は RLS が無効なので、このポリシーは効きません';
  end if;
end
$do$;

-- ------------------------------------------------------------
-- 5. 結果の確認
-- ------------------------------------------------------------
select
  c.relname                                    as table_name,
  c.relrowsecurity                             as rls_enabled,
  (p.policyname is not null)                   as policy_installed
from pg_class c
left join pg_policies p
  on p.tablename = c.relname
 and p.policyname like 'current pairing only%'
where c.relname in ('split_sessions', 'split_subscriptions', 'family_card_totals', 'shopping_items')
order by c.relname;
