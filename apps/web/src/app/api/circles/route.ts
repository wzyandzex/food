import { NextResponse } from 'next/server'
import { createServerClient, getAuthUserId } from '@/lib/supabase'

export interface CircleSummary {
  id: string
  name: string
  ownerId: string
  myRole: 'owner' | 'member'
  memberCount: number
  createdAt: string
  archiveCount: number
  latestMealDate: string | null
  currentOrderStatus: string | null
}

interface MemberRow {
  circle_id: string
  role: string
  circles: {
    id: string
    name: string
    owner_id: string
    created_at: string
    circle_members: Array<{ count: number }> | null
  } | null
}

/** 我的圈子列表（含成员数与我的角色） */
export async function GET(request: Request) {
  const userId = await getAuthUserId(request)
  if (!userId) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 })
  }

  try {
    const supabase = createServerClient()
    const { data, error } = await supabase
      .from('circle_members')
      .select('circle_id, role, circles(id, name, owner_id, created_at, circle_members(count))')
      .eq('user_id', userId)

    if (error) throw new Error(error.message)

    const rows = (data ?? []) as unknown as MemberRow[]
    const baseCircles = rows
      .filter((row) => row.circles)
      .map((row) => ({
        id: row.circle_id,
        name: row.circles?.name ?? '',
        ownerId: row.circles?.owner_id ?? '',
        myRole: row.role === 'owner' ? ('owner' as const) : ('member' as const),
        memberCount: row.circles?.circle_members?.[0]?.count ?? 1,
        createdAt: row.circles?.created_at ?? '',
      }))

    const circles = await Promise.all(baseCircles.map(async (circle) => {
      const [{ count: archiveCount }, { data: latestMemory }, { data: currentOrder }] = await Promise.all([
        supabase
          .from('circle_meal_memories')
          .select('id', { count: 'exact', head: true })
          .eq('circle_id', circle.id)
          .eq('status', 'published'),
        supabase
          .from('circle_meal_memories')
          .select('meal_date')
          .eq('circle_id', circle.id)
          .eq('status', 'published')
          .order('meal_date', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('order_sessions')
          .select('status')
          .eq('circle_id', circle.id)
          .in('status', ['open', 'closed', 'shopping', 'cooking'])
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ])

      return {
        ...circle,
        archiveCount: archiveCount ?? 0,
        latestMealDate: (latestMemory as { meal_date: string } | null)?.meal_date ?? null,
        currentOrderStatus: (currentOrder as { status: string } | null)?.status ?? null,
      }
    }))

    return NextResponse.json({ ok: true, circles })
  } catch (err) {
    console.error('圈子列表查询异常：', err)
    return NextResponse.json({ error: `系统异常：${(err as Error).message}` }, { status: 500 })
  }
}

/** 建圈：创建者自动成为 owner 成员 */
export async function POST(request: Request) {
  const userId = await getAuthUserId(request)
  if (!userId) {
    return NextResponse.json({ error: '请先登录后再建圈' }, { status: 401 })
  }

  const body = (await request.json().catch(() => null)) as { name?: unknown } | null
  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  if (!name || name.length > 20) {
    return NextResponse.json({ error: '圈名不能为空且不超过 20 字' }, { status: 400 })
  }

  try {
    const supabase = createServerClient()
    const { data: circle, error: circleError } = await supabase
      .from('circles')
      .insert({ name, owner_id: userId })
      .select('id')
      .single()

    if (circleError || !circle) {
      return NextResponse.json({ error: `建圈失败：${circleError?.message}` }, { status: 500 })
    }

    const { error: memberError } = await supabase.from('circle_members').insert({
      circle_id: circle.id,
      user_id: userId,
      role: 'owner',
    })

    if (memberError) {
      // 补偿删除避免空壳圈
      await supabase.from('circles').delete().eq('id', circle.id)
      return NextResponse.json({ error: `初始化成员失败：${memberError.message}` }, { status: 500 })
    }

    return NextResponse.json({ ok: true, circleId: circle.id })
  } catch (err) {
    console.error('建圈异常：', err)
    return NextResponse.json({ error: `系统异常：${(err as Error).message}` }, { status: 500 })
  }
}
