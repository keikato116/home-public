-- ============================================================
-- アカウント削除を成立させるための外部キー整理
-- Supabaseダッシュボード > SQL Editor で実行してください
-- ============================================================
--
-- auth.users を参照している外部キーの多くが ON DELETE 指定なし（= NO ACTION）で、
-- そのままだとユーザーを削除しようとした時点で外部キー違反になり、
-- 「アカウントを削除できないアプリ」になってしまう（App Store 5.1.1(v) 違反）。
--
-- 列名で意味を分けて張り直す:
--   created_by / completed_by … 「誰がやったか」の記録 → ON DELETE SET NULL
--                                （世帯に残る共有データ本体は消さない）
--   user_id                    … 「その人のもの」      → ON DELETE CASCADE
--                                （個人のルーティン、非公開の買い物アイテム等は消す）
--
-- ダッシュボードで後から作った表（meal_plans など）も拾えるよう、
-- 表を列挙せず pg_constraint を走査している。

do $$
declare
  r record;
begin
  for r in
    select
      con.conname            as constraint_name,
      cl.relname             as table_name,
      att.attname            as column_name
    from pg_constraint con
    join pg_class cl        on cl.oid = con.conrelid
    join pg_namespace ns    on ns.oid = cl.relnamespace
    join pg_class rf        on rf.oid = con.confrelid
    join pg_namespace rns   on rns.oid = rf.relnamespace
    join lateral unnest(con.conkey) as k(attnum) on true
    join pg_attribute att   on att.attrelid = cl.oid and att.attnum = k.attnum
    where con.contype = 'f'
      and ns.nspname  = 'public'
      and rns.nspname = 'auth'
      and rf.relname  = 'users'
      and con.confdeltype in ('a', 'r')   -- NO ACTION / RESTRICT のものだけ直す
      and array_length(con.conkey, 1) = 1
  loop
    execute format('alter table public.%I drop constraint %I', r.table_name, r.constraint_name);

    if r.column_name in ('created_by', 'completed_by', 'updated_by', 'paid_by') then
      execute format(
        'alter table public.%I add constraint %I foreign key (%I) references auth.users(id) on delete set null',
        r.table_name, r.constraint_name, r.column_name
      );
      raise notice 'set null: %.%', r.table_name, r.column_name;
    else
      execute format(
        'alter table public.%I add constraint %I foreign key (%I) references auth.users(id) on delete cascade',
        r.table_name, r.constraint_name, r.column_name
      );
      raise notice 'cascade : %.%', r.table_name, r.column_name;
    end if;
  end loop;
end $$;

-- 確認: 残っている NO ACTION の外部キーが 0 件であること
--   select cl.relname, con.conname, con.confdeltype
--   from pg_constraint con
--   join pg_class cl on cl.oid = con.conrelid
--   join pg_class rf on rf.oid = con.confrelid
--   where con.contype = 'f' and rf.relname = 'users' and con.confdeltype in ('a','r');
