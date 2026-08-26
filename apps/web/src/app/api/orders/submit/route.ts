import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const session = tokenData.order_sessions as any
    if (session?.status !== 'open') {
      return NextResponse.json({ error: '该点单已截单或已结束' }, { status: 400 })
    }

    // 截止时间锁定：超过 deadline 的提交一律拒绝（PRD §6.2 截止后锁定只读）
    if (session?.deadline && new Date(session.deadline).getTime() <= Date.now()) {
      return NextResponse.json({ error: '已超过截止时间，这场点单不再收单' }, { status: 400 })
    }

    // 2. 幂等 upsert 点单明细
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

    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: `系统异常：${(err as Error).message}` }, { status: 500 })
  }
}
