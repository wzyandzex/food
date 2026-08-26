import { NextResponse } from 'next/server'
import { createServerClient, getAuthUserId } from '@/lib/supabase'

type OrderStatus = 'open' | 'closed' | 'cooking' | 'done' | 'canceled'

/** 发起人对点单会话的状态流转（PRD §4.5 状态机 / §6.10）：
 *  open → closed（截单）→ cooking（开做）→ done（完成）；open/closed → canceled（取消） */
const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  open: ['closed', 'canceled'],
  closed: ['cooking', 'canceled'],
  cooking: ['done'],
  done: [],
  canceled: [],
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getAuthUserId(request)
  if (!userId) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 })
  }

  const { id } = await params
  const body = (await request.json().catch(() => null)) as { status?: unknown } | null
  const nextStatus = typeof body?.status === 'string' ? (body.status as OrderStatus) : null

  if (!nextStatus || !(nextStatus in ALLOWED_TRANSITIONS)) {
    return NextResponse.json({ error: '目标状态不合法' }, { status: 400 })
  }

  try {
    const supabase = createServerClient()

    const { data: session, error: sessionError } = await supabase
      .from('order_sessions')
      .select('id, status, host_id')
      .eq('id', id)
      .maybeSingle()

    if (sessionError) {
      console.error('点单状态查询失败：', sessionError.message)
      return NextResponse.json({ error: '查询点单失败' }, { status: 500 })
    }
    // 不存在或不属于当前用户一律按未找到处理
    if (!session || session.host_id !== userId) {
      return NextResponse.json({ error: '点单不存在或无权操作' }, { status: 404 })
    }

    const currentStatus = session.status as OrderStatus
    if (!ALLOWED_TRANSITIONS[currentStatus].includes(nextStatus)) {
      return NextResponse.json(
        { error: `当前状态（${currentStatus}）不能变更为 ${nextStatus}` },
        { status: 400 },
      )
    }

    const { error: updateError } = await supabase
      .from('order_sessions')
      .update({ status: nextStatus, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (updateError) {
      return NextResponse.json({ error: `状态更新失败：${updateError.message}` }, { status: 500 })
    }

    return NextResponse.json({ ok: true, status: nextStatus })
  } catch (err) {
    console.error('点单状态流转异常：', err)
    return NextResponse.json({ error: `系统异常：${(err as Error).message}` }, { status: 500 })
  }
}
