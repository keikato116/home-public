-- ============================================================
-- 家事ごとの通知時刻
--
-- 朝やる家事と夜やる家事があるので、家事1件ずつに時刻を持たせる。
-- null のときは、端末側で設定した既定の時刻（設定 → notification）を使う。
--
-- 世帯で共有する値にしている。家事そのものが世帯の持ち物なので、
-- 「ゴミ出しは朝7時」は2人にとって同じであるべきという判断。
-- 通知のオン・オフと既定の時刻は端末ごと（localStorage）。
-- ============================================================

alter table public.routine_definitions
  add column if not exists notify_at time;

-- 確認: notify_at が1行返れば成功
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'routine_definitions'
  and column_name = 'notify_at';
