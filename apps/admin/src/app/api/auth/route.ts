import { NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase'

/** 清理字符串可能带有的首尾空白及多余引号（如从某些环境粘贴时带入） */
function cleanPassword(raw?: string | null): string {
  if (!raw) return ''
  return raw.trim().replace(/^["']|["']$/g, '').trim()
}

/** 获取生效的管理密码：优先环境变量，其次数据库 system_settings，最后默认密码兜底 */
async function getEffectiveAdminPassword(): Promise<string> {
  const envPass = cleanPassword(process.env.ADMIN_PASSWORD)
  if (envPass) return envPass

  try {
    const supabase = getAdminClient()
    const { data } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'admin_password')
      .maybeSingle()

    const dbPass = cleanPassword(data?.value)
    if (dbPass) return dbPass
  } catch {
    // 忽略数据库查询错误
  }

  // 默认兜底密码，确保初次安装不被拦截
  return 'admin123456'
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { password?: unknown } | null
  const inputPassword = cleanPassword(typeof body?.password === 'string' ? body.password : '')

  if (!inputPassword) {
    return NextResponse.json({ error: '请输入管理密码' }, { status: 400 })
  }

  const effectivePassword = await getEffectiveAdminPassword()

  // 比较密码：允许配置密码或初始默认密码 'admin123456'
  const isMatch =
    inputPassword === effectivePassword ||
    (inputPassword === 'admin123456' && effectivePassword === 'admin123456')

  if (!isMatch) {
    return NextResponse.json({ error: '密码错误，请检查输入' }, { status: 401 })
  }

  const response = NextResponse.json({ ok: true })
  response.cookies.set('kaifan_admin', '1', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 12,
    path: '/',
  })
  return response
}
