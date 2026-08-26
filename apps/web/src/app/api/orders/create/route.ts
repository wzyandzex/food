import { NextResponse } from 'next/server'
import { randomBytes } from 'node:crypto'

import { createServerClient, getAuthUserId } from '@/lib/supabase'

/** 发起点单：生成 OrderSession + ShareToken，返回用于分享的短 token。
 *  发起人身份以 Authorization Bearer 为准，不信任请求体里的 hostId。 */
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

    return NextResponse.json({ ok: true, sessionId, token })
  } catch (err) {
    console.error('发起点单异常：', err)
    return NextResponse.json({ error: `系统异常：${(err as Error).message}` }, { status: 500 })
  }
}
