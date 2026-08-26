import { NextResponse } from 'next/server'
import { createServerClient, getAuthUserId } from '@/lib/supabase'
import type { NotificationRow } from '@/types/notifications'

/** 获取当前用户的通知列表与未读计数 */
export async function GET(request: Request) {
  const userId = await getAuthUserId(request)
  if (!userId) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 })
  }

  try {
    const supabase = createServerClient()
    const { data, error } = await supabase
      .from('notifications')
      .select('id, user_id, type, title, body, url, payload, read_at, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) {
      return NextResponse.json({ error: `获取通知失败：${error.message}` }, { status: 500 })
    }

    const notifications = (data as NotificationRow[]) ?? []
    const unreadCount = notifications.filter((n) => !n.read_at).length

    return NextResponse.json({ ok: true, unreadCount, notifications })
  } catch (err) {
    console.error('获取通知列表异常：', err)
    return NextResponse.json({ error: `系统异常：${(err as Error).message}` }, { status: 500 })
  }
}

/** 标记通知为已读（单条或全部） */
export async function PATCH(request: Request) {
  const userId = await getAuthUserId(request)
  if (!userId) {
    return NextResponse.json({ error: '请先登录后再操作' }, { status: 401 })
  }

  const body = (await request.json().catch(() => null)) as {
    id?: string
    markAllRead?: boolean
  } | null

  if (!body || (!body.markAllRead && typeof body.id !== 'string')) {
    return NextResponse.json({ error: '请指定要标记的通知或选择全部已读' }, { status: 400 })
  }

  try {
    const supabase = createServerClient()

    if (body.markAllRead) {
      const { error } = await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('user_id', userId)
        .is('read_at', null)

      if (error) {
        return NextResponse.json({ error: `批量标记失败：${error.message}` }, { status: 500 })
      }
      return NextResponse.json({ ok: true })
    }

    const { error } = await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('id', body.id)

    if (error) {
      return NextResponse.json({ error: `标记已读失败：${error.message}` }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: `系统异常：${(err as Error).message}` }, { status: 500 })
  }
}

/** 清空当前用户的全部已读通知 */
export async function DELETE(request: Request) {
  const userId = await getAuthUserId(request)
  if (!userId) {
    return NextResponse.json({ error: '请先登录后再操作' }, { status: 401 })
  }

  try {
    const supabase = createServerClient()
    await supabase.from('notifications').delete().eq('user_id', userId).not('read_at', 'is', null)

    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: `系统异常：${(err as Error).message}` }, { status: 500 })
  }
}
