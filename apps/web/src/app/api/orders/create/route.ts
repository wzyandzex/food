import { NextResponse } from 'next/server'
import { randomBytes } from 'node:crypto'

import { createServerClient, getAuthUserId } from '@/lib/supabase'
import { sendNotificationToUsers } from '@/lib/push-notifications'

/** 发起点单：生成 OrderSession + ShareToken，返回用于分享的短 token。
 *  发起人身份以 Authorization Bearer 为准，不信任请求体里的 hostId。
 *  可选 circleId：把点单挂到饭搭子群，创建后通知除发起人外的全体成员。 */
export async function POST(request: Request) {
  const hostId = await getAuthUserId(request)
  if (!hostId) {
    return NextResponse.json({ error: '请先登录后再发起点单' }, { status: 401 })
  }

  const body = (await request.json().catch(() => null)) as {
    title?: string
    deadline?: string
    allowFreeInput?: boolean
    perPersonLimit?: number
    candidateRecipeIds?: string[]
    circleId?: string
  } | null

  if (!body?.title || !body.deadline) {
    return NextResponse.json({ error: '缺少必填字段（title, deadline）' }, { status: 400 })
  }

  // 截止时间必须是未来时间且格式合法
  const deadlineTime = new Date(body.deadline).getTime()
  if (Number.isNaN(deadlineTime)) {
    return NextResponse.json({ error: '截止时间格式不正确' }, { status: 400 })
  }
  if (deadlineTime <= Date.now()) {
    return NextResponse.json({ error: '截止时间必须晚于当前时间' }, { status: 400 })
  }

  // 候选菜谱必须是合法 UUID（拦截样例菜名等假 id 写入 uuid 列）
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  const candidateRecipeIds = (body.candidateRecipeIds ?? []).filter(
    (id): id is string => typeof id === 'string' && UUID_RE.test(id),
  )

  try {
    const supabase = createServerClient()

    // 0. 圈内点单：校验发起人是该圈成员
    let circleId: string | null = null
    let circleName: string | null = null
    let circleNameForNotify: string | null = null
    if (typeof body?.circleId === 'string' && body.circleId.length > 0) {
      const UUID_RE_CIRCLE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      if (!UUID_RE_CIRCLE.test(body.circleId)) {
        return NextResponse.json({ error: '圈子标识不合法' }, { status: 400 })
      }

      const { data: membership, error: membershipError } = await supabase
        .from('circle_members')
        .select('role')
        .eq('circle_id', body.circleId)
        .eq('user_id', hostId)
        .maybeSingle()

      if (membershipError) throw new Error(membershipError.message)
      if (!membership) {
        return NextResponse.json({ error: '你不是这个饭搭子群的成员，无法往圈内发点单' }, { status: 403 })
      }

      const { data: circleRow } = await supabase.from('circles').select('name').eq('id', body.circleId).maybeSingle()
      circleId = body.circleId
      circleName = circleRow?.name ?? null
      circleNameForNotify = circleName
    }

    // 1. 创建 OrderSession（host_id 取自已验证身份）
    const { data: sessionData, error: sessionError } = await supabase
      .from('order_sessions')
      .insert({
        host_id: hostId,
        title: body.title,
        deadline: body.deadline,
        allow_free_input: body.allowFreeInput ?? false,
        per_person_limit: body.perPersonLimit ?? 3,
        candidate_recipe_ids: candidateRecipeIds,
        status: 'open',
        circle_id: circleId,
      })
      .select('id')
      .single()

    if (sessionError || !sessionData) {
      return NextResponse.json({ error: `创建点单失败：${sessionError?.message}` }, { status: 500 })
    }

    const sessionId = sessionData.id as string

    // 2. 生成 128-bit 随机 share token，默认 72h 有效
    const token = randomBytes(16).toString('hex')
    const expiresAt = new Date(Date.now() + 72 * 3600 * 1000).toISOString()

    const { error: tokenError } = await supabase.from('share_tokens').insert({
      token,
      order_session_id: sessionId,
      expires_at: expiresAt,
      revoked: false,
    })

    if (tokenError) {
      return NextResponse.json({ error: `生成分享令牌失败：${tokenError.message}` }, { status: 500 })
    }

    // 3. 圈内点单：通知除发起人外的全体成员（fire-and-forget）
    let notifiedCount = 0
    if (circleId) {
      try {
        const { data: memberRows } = await supabase
          .from('circle_members')
          .select('user_id')
          .eq('circle_id', circleId)
          .neq('user_id', hostId)

        const memberIds = (memberRows ?? []).map((row) => row.user_id as string)
        const { data: hostProfile } = await supabase
          .from('profiles')
          .select('nickname')
          .eq('id', hostId)
          .maybeSingle()

        const result = await sendNotificationToUsers(supabase, memberIds, {
          type: 'circle_order',
          title: `🍲 ${hostProfile?.nickname ?? '饭搭子'} 在${circleNameForNotify ? `「${circleNameForNotify}」` : '圈子里'}发起点单`,
          body: `「${body.title}」，截止 ${new Date(deadlineTime).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`,
          url: `/o/${token}`,
        })
        notifiedCount = result.notifiedCount
      } catch (notifyError) {
        console.error('圈内点单通知失败：', notifyError)
      }
    }

    return NextResponse.json({ ok: true, sessionId, token, circleName, notifiedCount })
  } catch (err) {
    console.error('发起点单异常：', err)
    return NextResponse.json({ error: `系统异常：${(err as Error).message}` }, { status: 500 })
  }
}
