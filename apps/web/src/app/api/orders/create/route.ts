import { NextResponse } from 'next/server'
import { randomBytes } from 'node:crypto'

import { createServerClient } from '@/lib/supabase'

/** 发起点单：生成 OrderSession + ShareToken，返回用于分享的短 token */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    hostId?: string
    title?: string
    deadline?: string
    allowFreeInput?: boolean
    perPersonLimit?: number
    candidateRecipeIds?: string[]
  } | null

  if (!body?.hostId || !body.title || !body.deadline) {
    return NextResponse.json({ error: '缺少必填字段（hostId, title, deadline）' }, { status: 400 })
  }

  try {
    const supabase = createServerClient()

    // 1. 创建 OrderSession
    const { data: sessionData, error: sessionError } = await supabase
      .from('order_sessions')
      .insert({
        host_id: body.hostId,
        title: body.title,
        deadline: body.deadline,
        allow_free_input: body.allowFreeInput ?? false,
        per_person_limit: body.perPersonLimit ?? 3,
        candidate_recipe_ids: body.candidateRecipeIds ?? [],
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
    return NextResponse.json({ error: `系统异常：${(err as Error).message}` }, { status: 500 })
  }
}
