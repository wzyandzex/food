-- 开饭 KaiFan · M3 排餐计划表
-- 在 Supabase SQL Editor 执行

create table if not exists public.meal_plan_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  plan_date date not null,
  meal_type text not null check (meal_type in ('breakfast', 'lunch', 'dinner', 'supper')),
  recipe_id uuid references public.recipes (id) on delete set null, -- 可空：支持自由文字安排
  snapshot_title text not null, -- 快照抗删除（与 cook_dishes 同款模式）
  note text,
  status text not null default 'planned' check (status in ('planned', 'cooked', 'skipped')),
  created_at timestamptz not null default now(),
  unique (user_id, plan_date, meal_type) -- 每天每餐一格，upsert 天然防重
);

create index if not exists meal_plan_user_date_idx on public.meal_plan_entries (user_id, plan_date);

alter table public.meal_plan_entries enable row level security;

-- 仅本人可读写自己的排餐计划
create policy meal_plan_owner on public.meal_plan_entries
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
