-- 开饭 KaiFan · M2 Web Push 订阅存储表 + 站内通知结构补全
-- 在 Supabase SQL Editor 执行

-- 1. notifications 表补充可读字段（0001 中仅有 type/payload）
alter table public.notifications
  add column if not exists title text not null default '开饭消息',
  add column if not exists body text not null default '',
  add column if not exists url text;

create index if not exists notifications_user_recent_idx
  on public.notifications (user_id, created_at desc);

-- 2. Push 订阅表
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, endpoint)
);

create index if not exists push_subs_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

-- 用户只能管理自己的 Push 订阅
create policy push_subs_owner on public.push_subscriptions
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
