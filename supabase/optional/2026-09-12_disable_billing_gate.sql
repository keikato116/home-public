-- ============================================================
-- 課金ゲートを一時的に外す（全員が有料機能を使える状態にする）
--
-- 目的:
--   課金を実装せずに公開する / まず無料で出す、という判断をしたとき用。
--
-- これを流さずに課金未実装のまま公開すると、
--   ・レシピと献立のタブが誰にも表示されない
--   ・仮に表示されても、保存しようとすると RLS に弾かれる
--   ・エラーの原因が画面に出ないので、利用者からは「壊れている」としか見えない
-- という状態になる。個人用プロジェクトで実際に起きたのがこれ。
--
-- 仕組み:
--   タブの出し分け（クライアント）も書き込み制限（restrictive ポリシー）も、
--   どちらも household_entitled() 一つを見ている。
--   なのでこの関数を「常に true」にすれば、両方まとめて開く。
--   subscriptions テーブルとポリシーはそのまま残るので、あとから戻せる。
--
-- 戻し方:
--   supabase/migrations/2026-09-11_subscriptions.sql をもう一度実行する。
--   （create or replace なので、関数が本来の判定に戻る）
-- ============================================================

create or replace function public.household_entitled()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select true;
$$;

revoke all on function public.household_entitled() from public;
grant execute on function public.household_entitled() to authenticated;

-- 確認: true が返れば成功
select public.household_entitled() as 課金ゲート解除済み;
