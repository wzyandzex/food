import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

let browserClient: SupabaseClient | null = null

/** 服务端数据源是否可用（URL + service_role key 均已配置） */
export function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY)
}

/** 浏览器端单例：用 anon key，走 RLS */
export function getBrowserClient(): SupabaseClient {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Supabase 环境变量未配置（NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY）')
  }
  browserClient ??= createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  return browserClient
}

/** 服务端客户端（SSR / Route Handler）：每请求新建，避免状态串扰 */
export function createServerClient(): SupabaseClient {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!SUPABASE_URL || !serviceRoleKey) {
    throw new Error('服务端缺少 Supabase 配置（NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY）')
  }
  return createClient(SUPABASE_URL, serviceRoleKey, {
    auth: { persistSession: false },
  })
}
