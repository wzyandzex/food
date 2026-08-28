-- 开饭 KaiFan · 共同餐桌档案
-- 发布到圈子的内容是显式快照，不放宽个人 CookSession 的可见性。

create table if not exists public.circle_meal_memories (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references public.circles(id) on delete cascade,
  source_order_session_id uuid references public.order_sessions(id) on delete set null,
  source_cook_session_id uuid references public.cook_sessions(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  title text not null check (char_length(title) between 1 and 80),
  meal_date date not null,
  meal_type text not null check (meal_type in ('breakfast', 'lunch', 'dinner', 'supper')),
  status text not null default 'draft' check (status in ('draft', 'published', 'withdrawn')),
  cover_url text,
  dishes jsonb not null default '[]'::jsonb check (jsonb_typeof(dishes) = 'array'),
  shared_note text check (shared_note is null or char_length(shared_note) <= 500),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.circle_meal_memories
  add column if not exists source_cook_session_id uuid references public.cook_sessions(id) on delete set null;

create index if not exists circle_meal_memories_circle_date_idx
  on public.circle_meal_memories (circle_id, meal_date desc, created_at desc);
create index if not exists circle_meal_memories_source_order_idx
  on public.circle_meal_memories (source_order_session_id);

create unique index if not exists circle_meal_memories_source_order_unique
  on public.circle_meal_memories (circle_id, source_order_session_id)
  where source_order_session_id is not null;

create index if not exists circle_meal_memories_source_cook_idx
  on public.circle_meal_memories (source_cook_session_id);

create unique index if not exists circle_meal_memories_source_cook_unique
  on public.circle_meal_memories (circle_id, source_cook_session_id)
  where source_cook_session_id is not null;

create table if not exists public.circle_meal_attendees (
  memory_id uuid not null references public.circle_meal_memories(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  nickname_snapshot text not null,
  added_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (memory_id, user_id)
);

create index if not exists circle_meal_attendees_user_idx
  on public.circle_meal_attendees (user_id, created_at desc);

create table if not exists public.circle_meal_contributions (
  id uuid primary key default gen_random_uuid(),
  memory_id uuid not null references public.circle_meal_memories(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  source_cook_session_id uuid references public.cook_sessions(id) on delete set null,
  dishes jsonb not null default '[]'::jsonb check (jsonb_typeof(dishes) = 'array'),
  photos text[] not null default '{}',
  shared_note text check (shared_note is null or char_length(shared_note) <= 300),
  rating smallint check (rating between 1 and 5),
  status text not null default 'shared' check (status in ('shared', 'withdrawn')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (memory_id, user_id)
);

create index if not exists circle_meal_contributions_memory_idx
  on public.circle_meal_contributions (memory_id, created_at asc);

alter table public.circle_meal_memories enable row level security;
alter table public.circle_meal_attendees enable row level security;
alter table public.circle_meal_contributions enable row level security;

drop policy if exists circle_meal_memories_member_read on public.circle_meal_memories;
create policy circle_meal_memories_member_read on public.circle_meal_memories
  for select to authenticated using (
    exists (
      select 1 from public.circle_members m
      where m.circle_id = circle_meal_memories.circle_id and m.user_id = auth.uid()
    ) and (status = 'published' or created_by = auth.uid())
  );

drop policy if exists circle_meal_memories_member_insert on public.circle_meal_memories;
create policy circle_meal_memories_member_insert on public.circle_meal_memories
  for insert to authenticated with check (
    created_by = auth.uid() and exists (
      select 1 from public.circle_members m
      where m.circle_id = circle_meal_memories.circle_id and m.user_id = auth.uid()
    )
  );

drop policy if exists circle_meal_memories_creator_update on public.circle_meal_memories;
create policy circle_meal_memories_creator_update on public.circle_meal_memories
  for update to authenticated using (
    created_by = auth.uid() or exists (
      select 1 from public.circles c
      where c.id = circle_meal_memories.circle_id and c.owner_id = auth.uid()
    )
  ) with check (
    created_by = auth.uid() or exists (
      select 1 from public.circles c
      where c.id = circle_meal_memories.circle_id and c.owner_id = auth.uid()
    )
  );

drop policy if exists circle_meal_attendees_member_read on public.circle_meal_attendees;
create policy circle_meal_attendees_member_read on public.circle_meal_attendees
  for select to authenticated using (
    exists (
      select 1 from public.circle_meal_memories memory
      join public.circle_members member on member.circle_id = memory.circle_id
      where memory.id = circle_meal_attendees.memory_id
        and member.user_id = auth.uid()
        and (memory.status = 'published' or memory.created_by = auth.uid())
    )
  );

drop policy if exists circle_meal_contributions_member_read on public.circle_meal_contributions;
create policy circle_meal_contributions_member_read on public.circle_meal_contributions
  for select to authenticated using (
    exists (
      select 1 from public.circle_meal_memories memory
      join public.circle_members member on member.circle_id = memory.circle_id
      where memory.id = circle_meal_contributions.memory_id
        and member.user_id = auth.uid()
        and memory.status = 'published'
    )
  );

drop policy if exists circle_meal_contributions_member_insert on public.circle_meal_contributions;
create policy circle_meal_contributions_member_insert on public.circle_meal_contributions
  for insert to authenticated with check (
    user_id = auth.uid() and exists (
      select 1 from public.circle_meal_memories memory
      join public.circle_members member on member.circle_id = memory.circle_id
      where memory.id = circle_meal_contributions.memory_id
        and member.user_id = auth.uid()
        and memory.status = 'published'
    )
  );

drop policy if exists circle_meal_contributions_owner_update on public.circle_meal_contributions;
create policy circle_meal_contributions_owner_update on public.circle_meal_contributions
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists circle_meal_contributions_owner_delete on public.circle_meal_contributions;
create policy circle_meal_contributions_owner_delete on public.circle_meal_contributions
  for delete to authenticated using (user_id = auth.uid());
