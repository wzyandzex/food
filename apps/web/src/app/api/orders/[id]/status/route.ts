import { NextResponse } from 'next/server'
import { ORDER_SESSION_STATUS_LABELS, type OrderSessionStatus } from '@kaifan/shared'
import { createServerClient, getAuthUserId } from '@/lib/supabase'
import { sendNotificationToUser } from '@/lib/push-notifications'

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

    // 通知所有已绑定身份的点单人（M2 通知中心；best-effort，失败不阻塞主流程）
    try {
      const { data: participants, error: participantsError } = await supabase
        .from('order_entries')
        .select('orderer_user_id')
        .eq('order_session_id', id)
        .not('orderer_user_id', 'is', null)

      if (participantsError) {
        console.error('查询点单参与者失败：', participantsError.message)
      } else {
        const typedRows = (participants ?? []) as Array<{ orderer_user_id: string | null }>
        const userIds = Array.from(
          new Set(typedRows.map((row) => row.orderer_user_id).filter((uid): uid is string => Boolean(uid))),
        )

        if (userIds.length > 0) {
          const statusLabel = ORDER_SESSION_STATUS_LABELS[nextStatus as OrderSessionStatus] ?? nextStatus
          void Promise.all(userIds.map((uid) =>
            sendNotificationToUser(supabase, {
              userId: uid,
              type: 'order_status',
              title: `👨‍🍳 点单状态更新为「${statusLabel}」`,
              body: '您参与的一场点单状态发生变化，点击查看详情',
              url: `/orders/${id}`,
            }),
          )).catch((err) => console.error('点单状态变更通知发送失败：', err))
        }
      }
    } catch (notifyError) {
      console.error('点单状态变更通知失败：', notifyError)
    }

    return NextResponse.json({ ok: true, status: nextStatus })
  } catch (err) {
    console.error('点单状态流转异常：', err)
    return NextResponse.json({ error: `系统异常：${(err as Error).message}` }, { status: 500 })
  }
}
