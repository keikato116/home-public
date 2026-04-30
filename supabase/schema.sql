-- ============================================================
-- いえアプリ Supabase スキーマ
-- Supabaseダッシュボード > SQL Editor で実行してください
-- ============================================================

-- households
create table public.households (
  id          uuid primary key default gen_random_uuid(),
  name        text not null default '我が家',
  invite_code text not null unique default upper(substring(replace(gen_random_uuid()::text,'-',''),1,8)),
  created_at  timestamptz default now()
);

-- household_members
create table public.household_members (
  household_id uuid references public.households(id) on delete cascade not null,
  user_id      uuid references auth.users(id) on delete cascade not null,
  joined_at    timestamptz default now(),
  primary key (household_id, user_id)
);

-- shared_todos（緊急・一時的todo）
create table public.shared_todos (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid references public.households(id) on delete cascade not null,
  label        text not null,
  done         boolean not null default false,
  created_by   uuid references auth.users(id),
  created_at   timestamptz default now(),
  "order"      integer not null default 0
);

-- routine_definitions（ルーティン定義）
create table public.routine_definitions (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid references public.households(id) on delete cascade not null,
  label        text not null,
  frequency    text not null check (frequency in ('daily','weekly','monthly')),
  day_of_week  integer check (day_of_week between 0 and 6),
  day_of_month integer check (day_of_month between 1 and 31),
  "order"      integer not null default 0,
  created_at   timestamptz default now()
);

-- routine_completions（当日完了記録）
create table public.routine_completions (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid references public.households(id) on delete cascade not null,
  definition_id uuid references public.routine_definitions(id) on delete cascade not null,
  completed_on  date not null,
  completed_by  uuid references auth.users(id),
  completed_at  timestamptz default now(),
  unique (definition_id, completed_on)
);

-- shopping_items
create table public.shopping_items (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid references public.households(id) on delete cascade not null,
  label        text not null,
  category     text not null default 'その他',
  done         boolean not null default false,
  "order"      integer not null default 0,
  created_at   timestamptz default now()
);

-- recipes
create table public.recipes (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid references public.households(id) on delete cascade not null,
  title         text not null,
  source_type   text not null check (source_type in ('url','photo','manual')),
  url           text,
  photo_path    text,
  ingredients   text,
  steps         text,
  thumbnail_url text,
  created_by    uuid references auth.users(id),
  created_at    timestamptz default now()
);

-- calendar_settings（世帯ごと）
create table public.calendar_settings (
  household_id    uuid primary key references public.households(id) on delete cascade,
  selected_colors text[] not null default '{}',
  start_date      date not null default current_date,
  updated_at      timestamptz default now()
);

-- ============================================================
-- RLS（Row Level Security）の有効化
-- ============================================================

alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.shared_todos enable row level security;
alter table public.routine_definitions enable row level security;
alter table public.routine_completions enable row level security;
alter table public.shopping_items enable row level security;
alter table public.recipes enable row level security;
alter table public.calendar_settings enable row level security;

-- ============================================================
-- RLS ポリシー
-- ============================================================

-- households
create policy "member can read household"
  on public.households for select
  using (
    exists (
      select 1 from public.household_members hm
      where hm.household_id = id and hm.user_id = auth.uid()
    )
  );

create policy "authenticated users can create household"
  on public.households for insert
  with check (auth.uid() is not null);

-- household_members
create policy "member can read memberships"
  on public.household_members for select
  using (
    exists (
      select 1 from public.household_members hm2
      where hm2.household_id = household_id and hm2.user_id = auth.uid()
    )
  );

create policy "user can insert own membership"
  on public.household_members for insert
  with check (user_id = auth.uid());

-- shared_todos
create policy "household members can manage shared todos"
  on public.shared_todos for all
  using (
    exists (
      select 1 from public.household_members hm
      where hm.household_id = shared_todos.household_id and hm.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.household_members hm
      where hm.household_id = shared_todos.household_id and hm.user_id = auth.uid()
    )
  );

-- routine_definitions
create policy "household members can manage routine definitions"
  on public.routine_definitions for all
  using (
    exists (
      select 1 from public.household_members hm
      where hm.household_id = routine_definitions.household_id and hm.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.household_members hm
      where hm.household_id = routine_definitions.household_id and hm.user_id = auth.uid()
    )
  );

-- routine_completions
create policy "household members can manage routine completions"
  on public.routine_completions for all
  using (
    exists (
      select 1 from public.household_members hm
      where hm.household_id = routine_completions.household_id and hm.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.household_members hm
      where hm.household_id = routine_completions.household_id and hm.user_id = auth.uid()
    )
  );

-- shopping_items
create policy "household members can manage shopping items"
  on public.shopping_items for all
  using (
    exists (
      select 1 from public.household_members hm
      where hm.household_id = shopping_items.household_id and hm.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.household_members hm
      where hm.household_id = shopping_items.household_id and hm.user_id = auth.uid()
    )
  );

-- recipes
create policy "household members can manage recipes"
  on public.recipes for all
  using (
    exists (
      select 1 from public.household_members hm
      where hm.household_id = recipes.household_id and hm.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.household_members hm
      where hm.household_id = recipes.household_id and hm.user_id = auth.uid()
    )
  );

-- calendar_settings
create policy "household members can manage calendar settings"
  on public.calendar_settings for all
  using (
    exists (
      select 1 from public.household_members hm
      where hm.household_id = calendar_settings.household_id and hm.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.household_members hm
      where hm.household_id = calendar_settings.household_id and hm.user_id = auth.uid()
    )
  );

-- ============================================================
-- Supabase Storage バケット設定
-- ダッシュボードの Storage > New bucket で作成するか、以下を実行:
-- ============================================================

-- insert into storage.buckets (id, name, public) values ('recipes', 'recipes', true);

-- create policy "authenticated users can upload recipe photos"
--   on storage.objects for insert
--   with check (bucket_id = 'recipes' and auth.uid() is not null);

-- create policy "anyone can read recipe photos"
--   on storage.objects for select
--   using (bucket_id = 'recipes');

-- create policy "uploader can delete recipe photos"
--   on storage.objects for delete
--   using (bucket_id = 'recipes' and auth.uid() is not null);

-- ============================================================
-- Realtime の有効化（ダッシュボード > Database > Replication）
-- 以下のテーブルを有効化してください:
--   - shared_todos
--   - routine_completions
--   - shopping_items
-- ============================================================
