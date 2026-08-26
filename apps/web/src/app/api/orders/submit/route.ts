import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { sendNotificationToUser } from '@/lib/push-notifications'

interface OrderItemInput {
  recipeId?: string
  freeText?: string
  servings?: number
  note?: string
}

/** 访客/好友提交点单（支持完全免登录，基于 clientKey 幂等） */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    token?: string
    nickname?: string
    userId?: string
    clientKey?: string
    items?: OrderItemInput[]
  } | null

  if (!body?.token || !body.nickname || !body.clientKey) {
    return NextResponse.json({ error: '缺少必填字段（token, nickname, clientKey）' }, { status: 400 })
  }

  if (!Array.isArray(body.items) || body.items.length === 0) {
    return NextResponse.json({ error: '请至少选择一道菜' }, { status: 400 })
  }

  try {
    const supabase = createServerClient()

    // 1. 验证 Token 有效性与所属会话
    const { data: tokenData, error: tokenError } = await supabase
      .from('share_tokens')
      .select('order_session_id, expires_at, revoked, order_sessions(status, deadline)')
      .eq('token', body.token)
      .single()

    if (tokenError || !tokenData) {
      return NextResponse.json({ error: '点单链接无效' }, { status: 400 })
    }

    if (tokenData.revoked || new Date(tokenData.expires_at).getTime() <= Date.now()) {
      return NextResponse.json({ error: '点单链接已过期或已失效' }, { status: 400 })
    }

    const session = tokenData.order_sessions as unknown as {
      status: string
      deadline: string
    } | null
    if (session?.status !== 'open') {
      return NextResponse.json({ error: '该点单已截单或已结束' }, { status: 400 })
    }

    // 截止时间锁定：超过 deadline 的提交一律拒绝（PRD §6.2 截止后锁定只读）
    if (session?.deadline && new Date(session.deadline).getTime() <= Date.now()) {
      return NextResponse.json({ error: '已超过截止时间，这场点单不再收单' }, { status: 400 })
    }

    // 2. 幂等 upsert 点单明细；先探测是首次提交还是覆盖修改（PRD §6.2）
    const { data: existingEntry } = await supabase
      .from('order_entries')
      .select('id')
      .eq('order_session_id', tokenData.order_session_id)
      .eq('client_key', body.clientKey)
      .maybeSingle()
    const isFirstSubmission = !existingEntry

    const { error: upsertError } = await supabase
      .from('order_entries')
      .upsert(
        {
          order_session_id: tokenData.order_session_id,
          orderer_nickname: body.nickname.trim(),
          orderer_user_id: body.userId || null,
          client_key: body.clientKey,
          items: body.items,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'order_session_id, client_key' },
      )

    if (upsertError) {
      return NextResponse.json({ error: `提交点单失败：${upsertError.message}` }, { status: 500 })
    }

    // 3. 仅首次提交时通知发起人「点单到达」；覆盖修改不再打扰（M2 通知中心）
    if (isFirstSubmission) {
      try {
        const { data: sessionRow, error: sessionRowError } = await supabase
          .from('order_sessions')
          .select('host_id, title')
          .eq('id', tokenData.order_session_id)
          .single()

        if (sessionRowError) {
          console.error('查询点单会话（用于通知）失败：', sessionRowError.message)
        } else {
          const dishNames = body.items
            .map((item) => item.freeText || item.recipeId)
            .filter(Boolean)
            .join('、')

          void sendNotificationToUser(supabase, {
            userId: sessionRow.host_id,
            type: 'order_arrived',
            title: `🍲 ${body.nickname.trim()} 提交了点单`,
            body: `「${sessionRow.title}」新点单动态：${dishNames || '有新的点菜'}`,
            url: `/orders/${tokenData.order_session_id}`,
          }).catch((err) => console.error('点单到达推送发送失败：', err))
        }
      } catch (notifyError) {
        // 通知发送失败不影响主流程
        console.error('点单到达通知发送失败：', notifyError)
      }
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: `系统异常：${(err as Error).message}` }, { status: 500 })
  }
}
