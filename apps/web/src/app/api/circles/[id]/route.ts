import { NextResponse } from 'next/server'
import { ORDER_SESSION_STATUS_LABELS, type OrderSessionStatus } from '@kaifan/shared'
import { createServerClient, getAuthUserId } from '@/lib/supabase'

interface MemberRow {
  user_id: string
  role: string
  profiles: { nickname: string } | null
}

/** 圈子详情：成员列表 + 圈内点单动态（仅圈成员可读） */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getAuthUserId(request)
  if (!userId) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 })
  }

  const { id } = await params

  try {
    const supabase = createServerClient()

    // 1. 成员资格校验
    const { data: myMembership, error: membershipError } = await supabase
      .from('circle_members')
      .select('role')
      .eq('circle_id', id)
      .eq('user_id', userId)
      .maybeSingle()

    if (membershipError) throw new Error(membershipError.message)
    if (!myMembership) {
      return NextResponse.json({ error: '圈子不存在或你还不是成员' }, { status: 403 })
    }
    const myRole = myMembership.role === 'owner' ? 'owner' : 'member'

    // 2. 基本信息 + 成员列表
    const [circleRes, membersRes, ordersRes] = await Promise.all([
      supabase.from('circles').select('id, name, owner_id, created_at').eq('id', id).maybeSingle(),
      supabase
        .from('circle_members')
        .select('user_id, role, profiles(nickname)')
        .eq('circle_id', id),
      supabase
        .from('order_sessions')
        .select('id, title, deadline, status, created_at')
        .eq('circle_id', id)
        .order('created_at', { ascending: false })
        .limit(20),
    ])

    if (circleRes.error) throw new Error(circleRes.error.message)
    if (membersRes.error) throw new Error(membersRes.error.message)
    if (ordersRes.error) throw new Error(ordersRes.error.message)

    const circle = circleRes.data as { id: string; name: string; owner_id: string; created_at: string } | null
    if (!circle) {
      return NextResponse.json({ error: '圈子不存在或已被解散' }, { status: 404 })
    }

    const members = ((membersRes.data ?? []) as unknown as MemberRow[]).map((row) => ({
      userId: row.user_id,
      nickname: row.profiles?.nickname ?? '饭搭子',
      role: row.role === 'owner' ? ('owner' as const) : ('member' as const),
      isMe: row.user_id === userId,
    }))

    const recentOrders = ((ordersRes.data ?? []) as Array<Record<string, unknown>>).map((row) => ({
      id: row.id as string,
      title: row.title as string,
      deadline: row.deadline as string,
      status: row.status as OrderSessionStatus,
      statusLabel: ORDER_SESSION_STATUS_LABELS[row.status as OrderSessionStatus] ?? String(row.status),
    }))

    return NextResponse.json({
      ok: true,
      circle: { id: circle.id, name: circle.name },
      myRole,
      members,
      recentOrders,
    })
  } catch (err) {
    console.error('圈子详情查询异常：', err)
    return NextResponse.json({ error: `系统异常：${(err as Error).message}` }, { status: 500 })
  }
}

/** 解散圈子：仅 owner；cascade 清成员与邀请，历史点单 circle_id 置空保留 */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getAuthUserId(request)
  if (!userId) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 })
  }

  const { id } = await params

  try {
    const supabase = createServerClient()
    const { data: circle, error: checkError } = await supabase
      .from('circles')
      .select('owner_id')
      .eq('id', id)
      .maybeSingle()

    if (checkError) throw new Error(checkError.message)
    if (!circle) return NextResponse.json({ error: '圈子不存在' }, { status: 404 })
    if (circle.owner_id !== userId) {
      return NextResponse.json({ error: '只有群主才能解散圈子' }, { status: 403 })
    }

    const { error } = await supabase.from('circles').delete().eq('id', id)
    if (error) throw new Error(error.message)

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('解散圈子异常：', err)
    return NextResponse.json({ error: `系统异常：${(err as Error).message}` }, { status: 500 })
  }
}
