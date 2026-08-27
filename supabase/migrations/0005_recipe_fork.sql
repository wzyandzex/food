-- 开饭 KaiFan · M3 菜谱改编（fork）溯源列
-- 在 Supabase SQL Editor 执行

alter table public.recipes
  add column if not exists derived_from uuid references public.recipes (id) on delete set null;

create index if not exists recipes_derived_from_idx on public.recipes (derived_from);
