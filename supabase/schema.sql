-- ============================================================
-- Home App ベーススキーマ（公開版・個人版 共通）
--
-- 新しい Supabase プロジェクトでは、このファイルを最初に実行する。
-- そのあと supabase/migrations/ の 2026-09-11_*.sql を3本、順に実行する。
--
-- 【重要】このファイルは、稼働中のデータベースから実際の構造を
-- 吸い出して作り直したもの。以前の版は meal_plans / split_sessions /
-- split_subscriptions / family_card_totals の4テーブルと、
-- shopping_items.user_id・split_sessions.her_ratio 等の列が欠けていた。
-- 手で編集するときは、実データベースとのズレを作らないよう注意する。
-- ============================================================

-- ------------------------------------------------------------
-- 世帯とメンバー
-- ------------------------------------------------------------

create table public.households (
  id           uuid primary key default gen_random_uuid(),
  name         text not null default '我が家',
  invite_code  text not null unique
                 default upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  created_at   timestamptz default now()
);

create table public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  joined_at    timestamptz default now(),
  primary key (household_id, user_id)
);

-- ------------------------------------------------------------
-- やること
-- ------------------------------------------------------------

create table public.shared_todos (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  label        text not null,
  done         boolean not null default false,
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz default now(),
  "order"      integer not null default 0
);

-- ------------------------------------------------------------
-- 家事ルーティン
--   user_id は「担当者」であって所有者ではない（世帯で共有する）
-- ------------------------------------------------------------

create table public.routine_definitions (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  label        text not null,
  frequency    text not null check (frequency in ('daily', 'weekly', 'monthly', 'once')),
  day_of_week  integer check (day_of_week between 0 and 6),
  day_of_month integer check (day_of_month between 1 and 31),
  due_date     date,
  user_id      uuid references auth.users(id) on delete cascade,
  -- 通知する時刻。null ならその家事は通知しない
  notify_at    time,
  "order"      integer not null default 0,
  created_at   timestamptz default now()
);

create table public.routine_completions (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households(id) on delete cascade,
  definition_id uuid not null references public.routine_definitions(id) on delete cascade,
  completed_on  date not null,
  completed_by  uuid references auth.users(id) on delete set null,
  completed_at  timestamptz default now(),
  unique (definition_id, completed_on)
);

-- ------------------------------------------------------------
-- 買い物リスト
--   user_id が入っている行 = 本人だけに見える非公開アイテム。
--   持ち主が抜けるときは行ごと消すこと（user_id だけ null にすると
--   「みんなのもの」になり、非公開メモが相手に見えてしまう）
-- ------------------------------------------------------------

create table public.shopping_items (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  label        text not null,
  category     text not null default 'その他',
  done         boolean not null default false,
  date         date,
  user_id      uuid references auth.users(id) on delete cascade,
  "order"      integer not null default 0,
  created_at   timestamptz default now()
);

-- ------------------------------------------------------------
-- レシピ
-- ------------------------------------------------------------

create table public.recipes (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households(id) on delete cascade,
  title         text not null,
  category      text,
  subcategory   text,
  url           text,
  ingredients   text,
  memo          text,
  thumbnail_url text,
  photo_urls    text[],
  cook_time_min integer,
  servings      integer,
  times_made    integer not null default 0,
  last_made_at  date,
  created_by    uuid references auth.users(id) on delete set null,
  created_at    timestamptz default now()
);

-- ------------------------------------------------------------
-- 献立
-- ------------------------------------------------------------

create table public.meal_plans (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  date         date not null,
  meal_type    text not null default 'dinner',
  recipe_id    uuid references public.recipes(id) on delete set null,
  label        text,
  created_at   timestamptz default now()
);

-- ------------------------------------------------------------
-- カレンダー
--   local_calendar_events.user_id は「作成者」であって所有者ではない
-- ------------------------------------------------------------

create table public.calendar_settings (
  household_id    uuid primary key references public.households(id) on delete cascade,
  start_date      date not null default current_date,
  selected_colors text[] not null default '{}',
  updated_at      timestamptz default now()
);

create table public.local_calendar_events (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  user_id      uuid references auth.users(id) on delete cascade,
  event_date   date not null,
  title        text not null,
  start_time   text,
  end_time     text,
  created_at   timestamptz default now()
);

-- ------------------------------------------------------------
-- Google カレンダー連携のトークン
--   /api/partner-calendar は service role でこの表を household_id で引く。
--   「いま世帯にいるか」は見ていないので、解散時は household_id の
--   付け替えが必須（メンバーを消すだけでは相手の予定が見え続ける）
-- ------------------------------------------------------------

create table public.user_tokens (
  user_id              uuid primary key references auth.users(id) on delete cascade,
  household_id         uuid references public.households(id) on delete cascade,
  google_access_token  text not null default '',
  google_refresh_token text not null default '',
  display_name         text not null default '',
  calendar_colors      text[],
  updated_at           timestamptz default now()
);

-- ------------------------------------------------------------
-- 割り勘
-- ------------------------------------------------------------

create table public.split_sessions (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households(id) on delete cascade,
  date          date not null,
  store         text not null default '',
  card          text not null check (card in ('mine', 'family')),
  items         jsonb not null default '[]'::jsonb,
  shared_amount integer not null default 0,
  her_ratio     double precision,
  created_at    timestamptz default now()
);

create table public.split_subscriptions (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name         text not null,
  amount       integer not null,
  card         text not null check (card in ('mine', 'family')),
  active       boolean not null default true,
  created_at   timestamptz default now()
);

-- 割り勘の設定（締め日・負担比率）。世帯で共有する。
-- households ではなく別表にしてあるのは、households に「ログイン済みなら誰でも
-- 引ける」select ポリシーがあるため（招待コードでの参加に必要）。
create table public.split_settings (
  household_id uuid primary key references public.households(id) on delete cascade,
  -- 0 = 暦月、1-28 = その日を締め日とする請求サイクル
  closing_day  integer not null default 0 check (closing_day between 0 and 28),
  -- 相手の負担比率（0.0-1.0）。既定は折半
  her_ratio    double precision not null default 0.5 check (her_ratio between 0 and 1),
  updated_at   timestamptz default now()
);

create table public.family_card_totals (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  year         integer not null,
  month        integer not null,
  total        integer not null default 0,
  created_at   timestamptz default now(),
  unique (household_id, year, month)
);

-- ============================================================
-- RLS（Row Level Security）の有効化
-- ============================================================

alter table public.households            enable row level security;
alter table public.household_members     enable row level security;
alter table public.shared_todos          enable row level security;
alter table public.routine_definitions   enable row level security;
alter table public.routine_completions   enable row level security;
alter table public.shopping_items        enable row level security;
alter table public.recipes               enable row level security;
alter table public.meal_plans            enable row level security;
alter table public.calendar_settings     enable row level security;
alter table public.local_calendar_events enable row level security;
alter table public.user_tokens           enable row level security;
alter table public.split_sessions        enable row level security;
alter table public.split_subscriptions   enable row level security;
alter table public.split_settings        enable row level security;
alter table public.family_card_totals    enable row level security;

-- ============================================================
-- ポリシー
-- ============================================================

-- 世帯
create policy "member can read household"
  on public.households for select
  using (
    exists (
      select 1 from public.household_members hm
      where hm.household_id = households.id and hm.user_id = auth.uid()
    )
  );

-- 招待コードで参加するために、ログイン済みなら世帯を引ける必要がある
create policy "authenticated can lookup household"
  on public.households for select
  using (auth.uid() is not null);

create policy "authenticated users can create household"
  on public.households for insert
  with check (auth.uid() is not null);

-- メンバー
create policy "member can read memberships"
  on public.household_members for select
  using (user_id = auth.uid());

create policy "user can insert own membership"
  on public.household_members for insert
  with check (user_id = auth.uid());

-- 世帯メンバーなら読み書きできる表
create policy "household members can manage shared todos"
  on public.shared_todos for all
  using (
    exists (select 1 from public.household_members hm
            where hm.household_id = shared_todos.household_id and hm.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.household_members hm
            where hm.household_id = shared_todos.household_id and hm.user_id = auth.uid())
  );

create policy "household members can manage routine definitions"
  on public.routine_definitions for all
  using (
    exists (select 1 from public.household_members hm
            where hm.household_id = routine_definitions.household_id and hm.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.household_members hm
            where hm.household_id = routine_definitions.household_id and hm.user_id = auth.uid())
  );

create policy "household members can manage routine completions"
  on public.routine_completions for all
  using (
    exists (select 1 from public.household_members hm
            where hm.household_id = routine_completions.household_id and hm.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.household_members hm
            where hm.household_id = routine_completions.household_id and hm.user_id = auth.uid())
  );

create policy "household members can manage recipes"
  on public.recipes for all
  using (
    exists (select 1 from public.household_members hm
            where hm.household_id = recipes.household_id and hm.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.household_members hm
            where hm.household_id = recipes.household_id and hm.user_id = auth.uid())
  );

create policy "household members can manage meal plans"
  on public.meal_plans for all
  using (
    household_id in (
      select hm.household_id from public.household_members hm
      where hm.user_id = auth.uid()
    )
  );

create policy "household members can manage calendar settings"
  on public.calendar_settings for all
  using (
    exists (select 1 from public.household_members hm
            where hm.household_id = calendar_settings.household_id and hm.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.household_members hm
            where hm.household_id = calendar_settings.household_id and hm.user_id = auth.uid())
  );

create policy "household members can manage local events"
  on public.local_calendar_events for all
  using (
    exists (select 1 from public.household_members hm
            where hm.household_id = local_calendar_events.household_id and hm.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.household_members hm
            where hm.household_id = local_calendar_events.household_id and hm.user_id = auth.uid())
  );

create policy "household members can manage split sessions"
  on public.split_sessions for all
  using (
    exists (select 1 from public.household_members hm
            where hm.household_id = split_sessions.household_id and hm.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.household_members hm
            where hm.household_id = split_sessions.household_id and hm.user_id = auth.uid())
  );

create policy "household members can manage split subscriptions"
  on public.split_subscriptions for all
  using (
    exists (select 1 from public.household_members hm
            where hm.household_id = split_subscriptions.household_id and hm.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.household_members hm
            where hm.household_id = split_subscriptions.household_id and hm.user_id = auth.uid())
  );

create policy "household members can manage split settings"
  on public.split_settings for all
  using (
    exists (select 1 from public.household_members hm
            where hm.household_id = split_settings.household_id and hm.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.household_members hm
            where hm.household_id = split_settings.household_id and hm.user_id = auth.uid())
  );

create policy "household members can manage family card totals"
  on public.family_card_totals for all
  using (
    exists (select 1 from public.household_members hm
            where hm.household_id = family_card_totals.household_id and hm.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.household_members hm
            where hm.household_id = family_card_totals.household_id and hm.user_id = auth.uid())
  );

-- 買い物リスト
--   世帯メンバーであることに加え、
--   user_id が null（共有）か、自分のもの（非公開）であること
create policy "household members can manage shopping items"
  on public.shopping_items for all
  using (
    exists (select 1 from public.household_members hm
            where hm.household_id = shopping_items.household_id and hm.user_id = auth.uid())
    and (shopping_items.user_id is null or shopping_items.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.household_members hm
            where hm.household_id = shopping_items.household_id and hm.user_id = auth.uid())
    and (shopping_items.user_id is null or shopping_items.user_id = auth.uid())
  );

-- Google トークン
create policy "user can manage own token"
  on public.user_tokens for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "household members can read tokens"
  on public.user_tokens for select
  using (
    exists (
      select 1
      from public.household_members hm1
      join public.household_members hm2 on hm1.household_id = hm2.household_id
      where hm1.user_id = auth.uid() and hm2.user_id = user_tokens.user_id
    )
  );

-- ============================================================
-- Data API への権限付与
--
-- Supabase の「Automatically expose new tables」がオンなら自動で付くが、
-- オフだとテーブルに権限が付かず、アプリが全部 permission denied で落ちる。
-- 設定に左右されないよう、ここで明示的に付けておく。
--
-- 行単位の制御は上の RLS ポリシーが行う。ここで与えるのは
-- 「表に触れてよい」という入口の権限だけで、中身の見える範囲は変わらない。
-- ============================================================

grant usage on schema public to anon, authenticated, service_role;

grant all on all tables    in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
grant all on all functions in schema public to anon, authenticated, service_role;

-- 以後この接続で作られる表にも同じ権限が付くようにする
alter default privileges in schema public
  grant all on tables    to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on functions to anon, authenticated, service_role;
