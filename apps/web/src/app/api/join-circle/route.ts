import { NextResponse } from 'next/server'
import { CIRCLE_MAX_MEMBERS } from '@kaifan/shared'
import { createServerClient, getAuthUserId } from '@/lib/supabase'

interface InviteRow {
  circle_id: string
  revoked: boolean
  expires_at: string
  circles: {
    id: string
    name: string
    profiles: { nickname: string } | null
    circle_members: Array<{ count: number }> | null
  } | null
}

/** 邀请链接预览（无需登录）：圈名、创建者昵称、当前人数——不暴露成员名单 */
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get('token') ?? ''

  try {
    const supabase = createServerClient()
    const { data, error } = await supabase
      .from('circle_invites')
      .select(
        'circle_id, revoked, expires_at, circles(id, name, profiles(nickname), circle_members(count))',
      )
      .eq('token', token)
      .maybeSingle()

    if (error) throw new Error(error.message)
    if (!data || data.revoked) {
      return NextResponse.json({ error: '邀请链接无效，请让群主重新分享' }, { status: 404 })
    }
    if (new Date(data.expires_at).getTime() <= Date.now()) {
      return NextResponse.json({ error: '邀请链接已过期（有效期 7 天），请让群主重新生成' }, { status: 410 })
    }

    const row = data as unknown as InviteRow
    const circle = row.circles
    if (!circle) {
      return NextResponse.json({ error: '圈子不存在或已被解散' }, { status: 404 })
    }

    const memberCount = circle.circle_members?.[0]?.count ?? 0

    return NextResponse.json({
      ok: true,
      circleName: circle.name,
      ownerNickname: circle.profiles?.nickname ?? '群主',
      memberCount,
      isFull: memberCount >= CIRCLE_MAX_MEMBERS,
    })
  } catch (err) {
    console.error('邀请预览异常：', err)
    return NextResponse.json({ error: `系统异常：${(err as Error).message}` }, { status: 500 })
  }
}

/** 通过邀请 token 加入圈子（需登录；幂等：重复加入视为成功） */
export async function POST(request: Request) {
  const userId = await getAuthUserId(request)
  if (!userId) {
    return NextResponse.json({ error: '请先登录后再加入圈子' }, { status: 401 })
  }

  const body = (await request.json().catch(() => null)) as { token?: unknown } | null
  const token = typeof body?.token === 'string' ? body.token.trim() : ''
  if (!token) {
    return NextResponse.json({ error: '缺少邀请码' }, { status: 400 })
  }

  try {
    const supabase = createServerClient()

    // 1. 校验邀请有效性（顺带取圈子信息）
    const { data, error } = await supabase
      .from('circle_invites')
      .select('circle_id, revoked, expires_at, circles(id, name)')
      .eq('token', token)
      .maybeSingle()

    if (error) throw new Error(error.message)
    if (!data || data.revoked) {
      return NextResponse.json({ error: '邀请链接无效，请让群主重新分享' }, { status: 404 })
    }
    if (new Date(data.expires_at).getTime() <= Date.now()) {
      return NextResponse.json({ error: '邀请链接已过期，请让群主重新生成' }, { status: 410 })
    }

    const circleId = data.circle_id as string
    const circle = data.circles as unknown as { id: string; name: string } | null
    if (!circle) {
      return NextResponse.json({ error: '圈子不存在或已被解散' }, { status: 404 })
    }

    // 2. 已是成员 → 幂等成功
    const { data: existing } = await supabase
      .from('circle_members')
      .select('user_id')
      .eq('circle_id', circleId)
      .eq('user_id', userId)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ ok: true, circleId, circleName: circle.name, alreadyMember: true })
    }

    // 3. 人数上限校验
    const { count, error: countError } = await supabase
      .from('circle_members')
      .select('user_id', { count: 'exact', head: true })
      .eq('circle_id', circleId)

    if (countError) throw new Error(countError.message)
    if ((count ?? 0) >= CIRCLE_MAX_MEMBERS) {
      return NextResponse.json({ error: `圈子已满（上限 ${CIRCLE_MAX_MEMBERS} 人）` }, { status: 400 })
    }

    // 4. 插入成员
    const { error: insertError } = await supabase.from('circle_members').insert({
      circle_id: circleId,
      user_id: userId,
      role: 'member',
    })

    if (insertError) throw new Error(insertError.message)

    return NextResponse.json({ ok: true, circleId, circleName: circle.name, alreadyMember: false })
  } catch (err) {
    console.error('加入圈子异常：', err)
    return NextResponse.json({ error: `系统异常：${(err as Error).message}` }, { status: 500 })
  }
}
