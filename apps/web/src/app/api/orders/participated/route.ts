import { NextResponse } from 'next/server'
import { createServerClient, getAuthUserId } from '@/lib/supabase'

interface ParticipatedItem {
  sessionId: string
  title: string
  status: string
  deadline: string
  myDishCount: number
}

/** 「我参与的点单」维度（PRD §4.5 双维点单记录）：
 *  按 orderer_user_id 找出我提交过点菜的会话，附会话状态与我点的菜数 */
export async function GET(request: Request) {
  const userId = await getAuthUserId(request)
  if (!userId) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 })
  }

  try {
    const supabase = createServerClient()

    const { data, error } = await supabase
      .from('order_entries')
      .select(
        'items, updated_at, order_sessions(id, title, status, deadline)',
      )
      .eq('orderer_user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(50)

    if (error) {
      console.error('「我参与的点单」查询失败：', error.message)
      return NextResponse.json({ error: '查询失败' }, { status: 500 })
    }

    // 同一会话可能有多条不同 client_key 的记录：按会话去重，保留最近一条并累加菜数
    const seen = new Map<string, ParticipatedItem>()
    type Row = {
      items: Array<{ recipeId?: string; freeText?: string }> | null
      updated_at: string
      order_sessions: { id: string; title: string; status: string; deadline: string } | null
    }
    for (const raw of (data ?? []) as unknown as Row[]) {
      const session = raw.order_sessions
      if (!session) continue

      const dishCount = (raw.items ?? []).length
      const existing = seen.get(session.id)
      if (existing) {
        existing.myDishCount += dishCount
      } else {
        seen.set(session.id, {
          sessionId: session.id,
          title: session.title,
          status: session.status,
          deadline: session.deadline,
          myDishCount: dishCount,
        })
      }
    }

    return NextResponse.json({ items: Array.from(seen.values()) })
  } catch (err) {
    console.error('「我参与的点单」异常：', err)
    return NextResponse.json({ error: `系统异常：${(err as Error).message}` }, { status: 500 })
  }
}
