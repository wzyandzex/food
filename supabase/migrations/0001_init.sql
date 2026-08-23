-- 开饭 KaiFan · 初始结构（Supabase Postgres）
-- 在 Supabase SQL Editor 执行，或 supabase db push
-- 设计依据：docs/prd-v1.md §7（一切以 CookSession「顿」为聚合根；菜谱软删 + 快照双保险）

create extension if not exists pgcrypto;
create extension if not exists pg_trgm; -- 菜谱标题模糊搜索

-- ============ 用户与准入 ============

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nickname text not null default '美食家',
  avatar_url text,
  diet_restrictions text[] not null default '{}', -- 忌口/过敏原档案
  role text not null default 'user' check (role in ('user', 'admin')),
  invite_code_used text,
  created_at timestamptz not null default now()
);

create table public.invite_codes (
  code text primary key,
  created_by uuid references public.profiles (id),
  max_uses int not null default 1 check (max_uses > 0),
  used_count int not null default 0,
  revoked boolean not null default false,
  created_at timestamptz not null default now()
);

-- ============ 菜谱 ============

create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  cover_url text,
  source_type text not null check (source_type in ('manual', 'json', 'xlsx', 'url', 'llm', 'ocr', 'open_data', 'user')),
  source_url text, -- URL 导入时必填，保留署名
  license text not null default 'internal',
  author_id uuid references public.profiles (id),
  servings int not null default 2 check (servings > 0),
  difficulty int not null default 2 check (difficulty between 1 and 5),
  minutes int not null check (minutes > 0),
  tags text[] not null default '{}',
  nutrition jsonb, -- recipe.v1 nutrition
  steps jsonb not null, -- recipe.v1 steps 数组（快照，避免结构演进破坏历史）
  ai_generated boolean not null default false,
  status text not null default 'published' check (status in ('draft', 'pending', 'published', 'offline')),
  deleted_at timestamptz, -- 软删：被引用的菜谱删除后历史记录仍可用
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index recipes_title_trgm_idx on public.recipes using gin (title gin_trgm_ops);
create index recipes_tags_idx on public.recipes using gin (tags);

create table public.ingredients (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  category text
);

create table public.recipe_ingredients (
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  ingredient_id uuid not null references public.ingredients (id),
  qty numeric,
  unit text,
  optional boolean not null default false,
  primary key (recipe_id, ingredient_id)
);

create table public.collections (
  user_id uuid not null references public.profiles (id) on delete cascade,
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  folder text not null default '默认收藏',
  created_at timestamptz not null default now(),
  primary key (user_id, recipe_id)
);

-- ============ 做饭记录（顿 = 聚合根）============

create table public.cook_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  date date not null,
  meal_type text not null check (meal_type in ('breakfast', 'lunch', 'dinner', 'supper')),
  note text,
  rating smallint check (rating between 1 and 5),
  order_session_id uuid, -- 关联点单会话（FK 在点单表建好后补加）
  created_at timestamptz not null default now()
);

create index cook_sessions_user_date_idx on public.cook_sessions (user_id, date desc);

create table public.cook_dishes (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.cook_sessions (id) on delete cascade,
  recipe_id uuid references public.recipes (id) on delete set null, -- 菜谱软删/删除时置空
  snapshot_title text not null, -- 快照：抗菜谱删除
  snapshot_cover text,
  photos text[] not null default '{}',
  adjust_note text -- 复盘：咸淡、用量调整
);

-- ============ 点单 ============

create table public.order_sessions (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.profiles (id),
  title text not null,
  deadline timestamptz not null,
  allow_free_input boolean not null default false,
  per_person_limit int not null default 3 check (per_person_limit > 0),
  status text not null default 'open' check (status in ('open', 'closed', 'cooking', 'done', 'canceled')),
  candidate_recipe_ids uuid[] not null default '{}',
  created_at timestamptz not null default now()
);

alter table public.cook_sessions
  add constraint cook_sessions_order_fk
  foreign key (order_session_id) references public.order_sessions (id) on delete set null;

create table public.share_tokens (
  token text primary key, -- 128bit 随机串的十六进制
  order_session_id uuid not null references public.order_sessions (id) on delete cascade,
  expires_at timestamptz not null,
  revoked boolean not null default false,
  created_at timestamptz not null default now()
);

create index share_tokens_session_idx on public.share_tokens (order_session_id);

create table public.order_entries (
  id uuid primary key default gen_random_uuid(),
  order_session_id uuid not null references public.order_sessions (id) on delete cascade,
  orderer_nickname text not null,
  orderer_user_id uuid references public.profiles (id), -- 渐进式身份归并：未绑定时为空
  client_key text not null, -- 匿名浏览器标识，幂等键
  items jsonb not null, -- [{recipe_id?, free_text?, servings, note}]
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (order_session_id, client_key) -- 同一浏览器覆盖式更新
);

create table public.shopping_lists (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id),
  source_order_session_id uuid references public.order_sessions (id) on delete set null,
  items jsonb not null default '[]', -- [{name, qty, unit, checked}]
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============ 通知 ============

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null, -- order_arrived | order_deadline | order_status | ...
  payload jsonb not null default '{}',
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_unread_idx on public.notifications (user_id) where read_at is null;

-- ============ RLS：默认全拒，仅放行自己的数据；管理端走 service_role（绕过 RLS）============

alter table public.profiles enable row level security;
alter table public.invite_codes enable row level security;
alter table public.recipes enable row level security;
alter table public.ingredients enable row level security;
alter table public.recipe_ingredients enable row level security;
alter table public.collections enable row level security;
alter table public.cook_sessions enable row level security;
alter table public.cook_dishes enable row level security;
alter table public.order_sessions enable row level security;
alter table public.share_tokens enable row level security;
alter table public.order_entries enable row level security;
alter table public.shopping_lists enable row level security;
alter table public.notifications enable row level security;

-- 已发布菜谱：所有登录用户可读（免登录浏览走服务端代理或 anon 只读策略，M1 定）
create policy recipes_published_read on public.recipes
  for select to authenticated using (status = 'published' and deleted_at is null);

-- 菜谱作者可改自己的
create policy recipes_author_write on public.recipes
  for update to authenticated using (author_id = auth.uid());

-- 收藏：仅本人
create policy collections_owner on public.collections
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 做饭记录：仅本人
create policy cook_sessions_owner on public.cook_sessions
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy cook_dishes_owner on public.cook_dishes
  for all to authenticated
  using (exists (select 1 from public.cook_sessions s where s.id = session_id and s.user_id = auth.uid()))
  with check (exists (select 1 from public.cook_sessions s where s.id = session_id and s.user_id = auth.uid()));

-- 点单：发起人管理自己的会话；点单人通过 token 在服务端代写（service_role）
create policy order_sessions_host on public.order_sessions
  for all to authenticated using (host_id = auth.uid()) with check (host_id = auth.uid());

-- 购物清单与通知：仅本人
create policy shopping_lists_owner on public.shopping_lists
  for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy notifications_owner on public.notifications
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 个人资料：本人可读写
create policy profiles_self on public.profiles
  for all to authenticated using (id = auth.uid()) with check (id = auth.uid());
