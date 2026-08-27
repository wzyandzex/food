-- 开饭 KaiFan · M3 饭搭子群（2–10 人固定小圈子）
-- 在 Supabase SQL Editor 执行

-- ============ 1. 圈子主表 ============

create table if not exists public.circles (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 20),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- ============ 2. 成员关联表（必须在建 policy 前创建）============

create table if not exists public.circle_members (
  circle_id uuid not null references public.circles (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  primary key (circle_id, user_id)
);

create index if not exists circle_members_user_idx on public.circle_members (user_id);

-- ============ 3. 邀请链接 token 表 ============

create table if not exists public.circle_invites (
  token text primary key, -- 128bit 随机串十六进制
  circle_id uuid not null references public.circles (id) on delete cascade,
  created_by uuid not null references public.profiles (id),
  expires_at timestamptz not null,
  revoked boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists circle_invites_circle_idx on public.circle_invites (circle_id);

-- ============ 4. 点单会话挂接圈子 ============

alter table public.order_sessions
  add column if not exists circle_id uuid references public.circles (id) on delete set null;

create index if not exists order_sessions_circle_idx on public.order_sessions (circle_id);

-- ============ 5. RLS 策略（表全部创建完成后再绑定）============

alter table public.circles enable row level security;
alter table public.circle_members enable row level security;
alter table public.circle_invites enable row level security;

-- 成员可读自己的圈子
drop policy if exists circles_member_read on public.circles;
create policy circles_member_read on public.circles
  for select to authenticated using (
    exists (
      select 1 from public.circle_members m
      where m.circle_id = circles.id and m.user_id = auth.uid()
    )
  );

-- 成员可读自己圈内的成员列表
drop policy if exists circle_members_read on public.circle_members;
create policy circle_members_read on public.circle_members
  for select to authenticated using (
    exists (
      select 1 from public.circle_members me
      where me.circle_id = circle_members.circle_id and me.user_id = auth.uid()
    )
  );
