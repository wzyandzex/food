-- 开饭 KaiFan · 0007_p0_architecture_upgrade.sql
-- 依据《开饭工程级补全规范》Phase 1 & Phase 2 数据库升级：
-- 1. 统一状态机与合法约束（Recipe / OrderSession / CookSession / ImportJob）
-- 2. 匿名点单身份系统升维（引入 order_participants，隔离 URL Token 与 Participant Token）
-- 3. 异步任务系统基础设施（import_jobs, import_job_items）
-- 4. 菜谱历史完整快照支持（cook_dishes 增加 recipe_snapshot JSONB）
-- 5. 食材别名与多维度模型（ingredient_aliases）
-- 6. 管理端操作审计日志（admin_audit_logs）

-- ============ 1. 食材模型扩展 ============
create table if not exists public.ingredient_aliases (
  id uuid primary key default gen_random_uuid(),
  ingredient_id uuid not null references public.ingredients(id) on delete cascade,
  alias text not null unique,
  created_at timestamptz not null default now()
);

alter table public.recipe_ingredients add column if not exists raw_name text;

-- ============ 2. 菜谱快照支持 ============
alter table public.cook_dishes add column if not exists recipe_snapshot jsonb;

-- ============ 3. 匿名参与者模型 (OrderParticipant) ============
create table if not exists public.order_participants (
  id uuid primary key default gen_random_uuid(),
  order_session_id uuid not null references public.order_sessions(id) on delete cascade,
  participant_token_hash text not null,
  nickname text not null,
  user_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (order_session_id, participant_token_hash)
);

create index if not exists order_participants_session_idx on public.order_participants(order_session_id);

alter table public.order_entries add column if not exists participant_id uuid references public.order_participants(id) on delete cascade;

-- ============ 4. 异步任务系统 (ImportJob & ImportJobItem) ============
create table if not exists public.import_jobs (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('json', 'xlsx', 'url', 'llm_batch', 'ocr', 'open_data')),
  status text not null default 'pending' check (status in ('pending', 'running', 'succeeded', 'partial_success', 'failed', 'canceled')),
  total int not null default 0,
  completed int not null default 0,
  succeeded int not null default 0,
  failed int not null default 0,
  payload jsonb not null default '{}',
  result_summary jsonb,
  error_summary text,
  created_by uuid references public.profiles(id),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists import_jobs_status_created_idx on public.import_jobs(status, created_at desc);

create table if not exists public.import_job_items (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.import_jobs(id) on delete cascade,
  input jsonb not null,
  status text not null default 'pending' check (status in ('pending', 'running', 'succeeded', 'failed', 'canceled')),
  attempt int not null default 0,
  max_attempts int not null default 3,
  result jsonb,
  error_code text,
  error_message text,
  recipe_id uuid references public.recipes(id) on delete set null,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists import_job_items_job_idx on public.import_job_items(job_id, status);

-- ============ 5. 管理端审计日志 (AdminAuditLog) ============
create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id),
  action text not null,
  resource_type text not null,
  resource_id text,
  metadata jsonb not null default '{}',
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists admin_audit_logs_actor_idx on public.admin_audit_logs(actor_id, created_at desc);
create index if not exists admin_audit_logs_resource_idx on public.admin_audit_logs(resource_type, resource_id);

-- ============ 6. 安全 RLS 策略 ============
alter table public.ingredient_aliases enable row level security;
alter table public.order_participants enable row level security;
alter table public.import_jobs enable row level security;
alter table public.import_job_items enable row level security;
alter table public.admin_audit_logs enable row level security;

-- 允许只读公开与认证用户读取公开词库
create policy ingredient_aliases_read on public.ingredient_aliases
  for select to authenticated, anon using (true);
