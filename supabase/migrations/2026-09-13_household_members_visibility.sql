-- ============================================================
-- 同じ世帯のメンバーどうしが、お互いの所属行を見えるようにする
--
-- それまでの select ポリシーは user_id = auth.uid() のみで、
-- 「自分の所属行」しか読めなかった。そのため household_id で引いても
-- 自分1行しか返らず、人数が常に1人と判定されていた。
--
-- 公開版はモードをフラグではなく人数から導いているので、これが効くと:
--   ・2人になっても「1人で使用中」のまま
--   ・割り勘タブが永久に表示されない
--   ・相手の名前が出ない、解散ボタンも出ない
-- 個人版には人数による出し分けが無かったため、表面化していなかった。
--
-- ポリシーの中で household_members を引くと再帰してしまうので、
-- security definer の関数に包んで RLS を迂回する（Supabase の定石）。
-- ============================================================

create or replace function public.is_household_member(hid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.household_members
    where household_id = hid
      and user_id = auth.uid()
  );
$$;

revoke all on function public.is_household_member(uuid) from public;
grant execute on function public.is_household_member(uuid) to authenticated;

drop policy if exists "member can read memberships" on public.household_members;

create policy "member can read memberships"
  on public.household_members for select
  using (public.is_household_member(household_id));

-- 確認: 1 が返れば成功
select count(*) as ポリシー
from pg_policies
where schemaname = 'public'
  and tablename = 'household_members'
  and policyname = 'member can read memberships';
