-- 开饭 KaiFan · M3 动态系统配置表（支持后台免部署修改 LLM 密钥与端点）
-- 在 Supabase SQL Editor 执行

create table if not exists public.system_settings (
  key text primary key,
  value text not null,
  description text,
  updated_at timestamptz not null default now()
);

alter table public.system_settings enable row level security;

-- 仅通过服务端 service_role 访问，普通客户端无权限读取
