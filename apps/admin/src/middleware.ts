import { NextRequest, NextResponse } from 'next/server'

const ADMIN_COOKIE = 'kaifan_admin'

/** 管理端会话校验：检查 /api/auth 下发的会话 Cookie 是否存在。
 *  注：M0 占位认证的 Cookie 值为固定串，仅验证「已登录」这一事实，
 *  不提供防伪造保证；彻底解决依赖 PRD §4.7 的 Supabase Auth + 管理员角色。 */
function hasAdminSession(request: NextRequest): boolean {
  return request.cookies.has(ADMIN_COOKIE)
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // API 路由（/api/auth 已在 matcher 中放行）：未登录返回 401，不写库
  if (pathname.startsWith('/api/')) {
    if (!hasAdminSession(request)) {
      return NextResponse.json({ error: '未登录' }, { status: 401 })
    }
    return NextResponse.next()
  }

  // 页面路由：未登录重定向到登录页
  if (!hasAdminSession(request)) {
    const loginUrl = new URL('/login', request.url)
    return NextResponse.redirect(loginUrl)
  }
  return NextResponse.next()
}

export const config = {
  // 默认保护管理端所有路由，仅显式放行登录页、认证接口与静态资源
  matcher: ['/((?!_next|login|api/auth|favicon.ico|.*\\..*).*)'],
}
