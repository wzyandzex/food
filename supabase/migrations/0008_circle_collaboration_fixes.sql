-- 开饭 KaiFan · 圈内协作基础契约修复

alter table public.order_sessions
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  alter table public.order_sessions drop constraint if exists order_sessions_status_check;
  alter table public.order_sessions
    add constraint order_sessions_status_check
    check (status in ('open', 'closed', 'shopping', 'cooking', 'done', 'canceled'));
exception when duplicate_object then
  null;
end $$;

create index if not exists order_sessions_circle_created_idx
  on public.order_sessions (circle_id, created_at desc);
