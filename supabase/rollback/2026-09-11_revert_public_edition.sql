-- ============================================================
-- 【個人用の Supabase だけで実行すること】
-- 公開版（home-public）のために入れたルールを取り除く
-- ============================================================
--
-- ⚠️ 公開版のプロジェクトで流さないこと。課金ゲートと部屋の区切りが全部外れる。
--
-- 公開版を別プロジェクトに分けたあと、彼女と2人で使っている web app 側の
-- データベースを元の状態に戻すためのもの。
--
-- 外すもの:
--   - 課金していないと書けない制限（recipes / meal_plans）
--   - 課金判定の関数と subscriptions テーブル
--   - 「部屋」（ペアの期間）の区切りと、その更新トリガー
--
-- 外さないもの（残しておいて損がないため）:
--   - auth.users を参照する外部キーの ON DELETE 指定
--     （2026-09-11_account_deletion.sql）
--     元に戻すとアカウントを削除できない状態に逆戻りする
--   - split 系に足した created_at 列。ただの記録用で害がない
--
-- 何度流しても同じ結果になる。

-- ------------------------------------------------------------
-- 1. 課金ゲートを外す
-- ------------------------------------------------------------
drop policy if exists "premium required to insert recipes"    on public.recipes;
drop policy if exists "premium required to update recipes"    on public.recipes;
drop policy if exists "premium required to insert meal plans" on public.meal_plans;
drop policy if exists "premium required to update meal plans" on public.meal_plans;

drop function if exists public.household_entitled();
drop table if exists public.subscriptions;

-- ------------------------------------------------------------
-- 2. 部屋の区切りを外す
-- ------------------------------------------------------------
do $do$
declare
  t text;
begin
  foreach t in array array['split_sessions', 'split_subscriptions', 'family_card_totals'] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop policy if exists "current pairing only" on public.%I', t);
    end if;
  end loop;
end
$do$;

drop policy if exists "current pairing only for shared items" on public.shopping_items;

drop trigger if exists household_members_pairing_bump on public.household_members;
drop function if exists public.bump_pairing_started_at();

alter table public.households drop column if exists pairing_started_at;

-- ------------------------------------------------------------
-- 3. 確認
-- ------------------------------------------------------------
-- どちらも 0 件になっていれば、公開版のルールは残っていない。
select policyname, tablename
from pg_policies
where policyname like 'premium required%'
   or policyname like 'current pairing only%';

select proname
from pg_proc
where proname in ('household_entitled', 'bump_pairing_started_at');
