-- ============================================================
-- Phase 6: レガシーデータ整理
-- Supabaseダッシュボード > SQL Editor で実行してください
-- 実行前に件数確認クエリ（各セクション冒頭のコメント）を流すこと
-- ============================================================

-- ------------------------------------------------------------
-- 6-1. レガシー highlight_* meal_type の正規化
-- 確認: select count(*) from public.meal_plans where meal_type like 'highlight_%';
-- ------------------------------------------------------------

update public.meal_plans
set meal_type = replace(meal_type, 'highlight_', ''),
    recipe_id = null,
    label     = null
where meal_type in ('highlight_dinner', 'highlight_lunch');

-- ------------------------------------------------------------
-- 6-2. split_sessions の per-session 比率を専用カラムへ
--      （items 配列内の {"name":"__ratio__","price":0.5} 疑似アイテムから移行）
-- 確認: select count(*) from public.split_sessions
--        where items::jsonb @> '[{"name":"__ratio__"}]';
-- ------------------------------------------------------------

alter table public.split_sessions
  add column if not exists her_ratio double precision;

update public.split_sessions s
set her_ratio = (
  select (item->>'price')::double precision
  from jsonb_array_elements(s.items::jsonb) item
  where item->>'name' = '__ratio__'
  limit 1
)
where s.her_ratio is null;

-- ------------------------------------------------------------
-- 実行後の確認:
--   select count(*) from public.meal_plans where meal_type like 'highlight_%';  -- 0 のはず
--   select count(*) from public.split_sessions where her_ratio is not null;
-- 確認後、Cook タブのハイライト表示と Split タブの金額計算を実機でチェック
-- ============================================================
