-- 0003：通知中心安全整改 + 截单提醒支撑
-- 背景 1（#21）：VAPID 私钥曾误提交至 .env.example 并进入 git 历史，密钥已轮换。
--   按旧公钥建立的推送订阅在新公钥下全部失效，直接清空让用户重新订阅。
truncate table public.push_subscriptions;

-- 背景 2（#25 截单提醒）：需要防重复提醒的落库标记
alter table public.order_sessions
  add column deadline_reminder_sent_at timestamptz;

create index order_sessions_deadline_open_idx
  on public.order_sessions (deadline)
  where status = 'open' and deadline_reminder_sent_at is null;
