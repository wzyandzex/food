import { NextResponse } from 'next/server'
import { createServerClient, getAuthUserId } from '@/lib/supabase'

/** 前端 PushSubscription.toJSON() 的 keys 结构 */
interface PushKeys {
  p256dh: string
  auth: string
}

/** 保存/更新当前设备的 Web Push 订阅 */
export async function POST(request: Request) {
  const userId = await getAuthUserId(request)
  if (!userId) {
    return NextResponse.json({ error: '请先登录后再开启推送' }, { status: 401 })
  }

  const body = (await request.json().catch(() => null)) as {
    endpoint?: unknown
    keys?: Partial<PushKeys>
    userAgent?: string
  } | null

  if (
    !body ||
    typeof body.endpoint !== 'string' ||
    !body.keys ||
    typeof body.keys.p256dh !== 'string' ||
    typeof body.keys.auth !== 'string'
  ) {
    return NextResponse.json({ error: '无效的推送订阅数据' }, { status: 400 })
  }

  try {
    const supabase = createServerClient()

    // Upsert 同一用户+端点（同一浏览器反复订阅幂等）
    const { error: upsertError } = await supabase.from('push_subscriptions').upsert(
      {
        user_id: userId,
        endpoint: body.endpoint,
        p256dh: body.keys.p256dh,
        auth: body.keys.auth,
        user_agent: typeof body.userAgent === 'string' ? body.userAgent : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id, endpoint' },
    )

    if (upsertError) {
      console.error('保存 Push 订阅失败：', upsertError.message)
      return NextResponse.json({ error: `保存订阅失败：${upsertError.message}` }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: `系统异常：${(err as Error).message}` }, { status: 500 })
  }
}

/** 移除当前设备订阅（用户主动关闭推送） */
export async function DELETE(request: Request) {
  const userId = await getAuthUserId(request)
  if (!userId) {
    return NextResponse.json({ error: '请先登录后再操作' }, { status: 401 })
  }

  const body = (await request.json().catch(() => null)) as { endpoint?: unknown } | null
  if (typeof body?.endpoint !== 'string') {
    return NextResponse.json({ error: '缺少订阅端点' }, { status: 400 })
  }

  try {
    const supabase = createServerClient()
    await supabase
      .from('push_subscriptions')
      .delete()
      .eq('user_id', userId)
      .eq('endpoint', body.endpoint)

    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: `系统异常：${(err as Error).message}` }, { status: 500 })
  }
}
