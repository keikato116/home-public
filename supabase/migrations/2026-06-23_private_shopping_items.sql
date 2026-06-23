-- ============================================================
-- 個人専用（非公開）買い物リストのサポート
-- shopping_items に user_id カラムを追加
-- user_id IS NULL → 共有アイテム（全メンバーが見える）
-- user_id IS NOT NULL → 本人のみが見える
-- ============================================================

alter table public.shopping_items
  add column if not exists user_id uuid references auth.users(id);

-- 既存ポリシーを削除して再作成
drop policy if exists "household members can manage shopping items" on public.shopping_items;

create policy "household members can manage shopping items"
  on public.shopping_items for all
  using (
    exists (
      select 1 from public.household_members hm
      where hm.household_id = shopping_items.household_id and hm.user_id = auth.uid()
    )
    and (shopping_items.user_id is null or shopping_items.user_id = auth.uid())
  )
  with check (
    exists (
      select 1 from public.household_members hm
      where hm.household_id = shopping_items.household_id and hm.user_id = auth.uid()
    )
    and (shopping_items.user_id is null or shopping_items.user_id = auth.uid())
  );
