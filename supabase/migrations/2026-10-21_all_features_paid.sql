-- ============================================================
-- すべての機能を有料にする（DB 側の課金ゲート）
-- Supabaseダッシュボード > SQL Editor で実行してください
-- （2026-10-21_premium_grants.sql のあとに）
-- ============================================================
--
-- ⚠️ 流した瞬間から、権利（購入 or 運営の付与）を持っていない人は、
--    予定・家事・買い物・割り勘などを一切保存できなくなる。
--    先に自分たちと審査用アカウントに grant_premium() で付与しておくこと。
--
-- 2人で使う世帯では2人とも権利が要る（household_entitled()）。
-- 片方の権利が切れたら、切れた人が自動で抜ける（src/lib/server/lapseExit.ts）ので、
-- 払っている人が巻き添えで書けなくなるのは、その処理が走るまでの短い間だけ。
--
-- 2026-09-11_subscriptions.sql でレシピと献立に入れたのと同じ形:
-- restrictive なので既存の「世帯メンバーなら操作できる」ポリシーと AND される。
-- 絞るのは insert と update だけ。select と delete は絞らない
-- （解約しても、自分のデータが読めない・消せない状態にはしない）。
--
-- 対象外:
--   member_profiles … 表示名。加入前の初回登録で入力するため
--   user_tokens     … Google の鍵。サーバー（/api/tokens）経由でしか書かない
--   households / household_members … サーバーが service role で書く
--
-- 何度流しても同じ結果になる。表が無ければ NOTICE を出して飛ばす。

do $do$
declare
  t text;
begin
  foreach t in array array[
    'shared_todos',
    'routine_definitions',
    'routine_completions',
    'shopping_items',
    'local_calendar_events',
    'calendar_settings',
    'split_sessions',
    'split_subscriptions',
    'family_card_totals',
    'split_settings',
    'recipes',
    'meal_plans'
  ] loop
    if to_regclass('public.' || t) is null then
      raise notice 'スキップ: public.% という表がありません', t;
      continue;
    end if;

    execute format('drop policy if exists "premium required to insert %s" on public.%I', t, t);
    execute format(
      'create policy "premium required to insert %s" on public.%I as restrictive for insert with check (public.household_entitled())',
      t, t
    );
    execute format('drop policy if exists "premium required to update %s" on public.%I', t, t);
    execute format(
      'create policy "premium required to update %s" on public.%I as restrictive for update using (public.household_entitled())',
      t, t
    );
  end loop;
end
$do$;

-- 2026-09-11_subscriptions.sql が付けた旧名のポリシー（中身は同じ）を片づける
drop policy if exists "premium required to insert meal plans" on public.meal_plans;
drop policy if exists "premium required to update meal plans" on public.meal_plans;

-- 確認: 12表 × 2 = 24 行
select tablename, policyname from pg_policies
where policyname like 'premium required to %'
order by tablename, policyname;
