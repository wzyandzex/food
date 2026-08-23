import { NextResponse } from 'next/server'

/** M0 占位认证：与 ADMIN_PASSWORD 比对并下发会话 Cookie。
 *  M1 将替换为 Supabase Auth + 管理员角色（PRD §4.7），此接口仅验证骨架链路。 */
export async function POST(request: Request) {
  const adminPassword = process.env.ADMIN_PASSWORD
  if (!adminPassword) {
    return NextResponse.json({ error: '未配置 ADMIN_PASSWORD，登录未开放' }, { status: 503 })
  }

  const body = (await request.json().catch(() => null)) as { password?: unknown } | null
  if (typeof body?.password !== 'string' || body.password !== adminPassword) {
    return NextResponse.json({ error: '密码错误' }, { status: 401 })
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
