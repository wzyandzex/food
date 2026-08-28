import { NextResponse } from 'next/server'
import { ORDER_SESSION_STATUS_LABELS, type OrderSessionStatus } from '@kaifan/shared'
import { requireCircleAccess } from '@/lib/circle-access'
import { listCircleMeals } from '@/lib/circle-meals'
import { createServerClient } from '@/lib/supabase'

interface CircleHomeOrder {
  id: string
  title: string
  deadline: string
  status: OrderSessionStatus
  statusLabel: string
  participantCount: number
  createdAt: string
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const accessResult = await requireCircleAccess(request, id)
  if (!accessResult.ok) return NextResponse.json({ error: accessResult.error }, { status: accessResult.status })

  try {
    const supabase = createServerClient()
    const [ordersResult, membersResult, memories] = await Promise.all([
      supabase
        .from('order_sessions')
        .select('id, title, deadline, status, created_at')
        .eq('circle_id', id)
        .order('created_at', { ascending: false })
        .limit(20),
      supabase
        .from('circle_members')
        .select('user_id, role, profiles(nickname)')
        .eq('circle_id', id)
        .order('created_at', { ascending: true }),
      listCircleMeals(accessResult.access),
    ])

    if (ordersResult.error) throw new Error(ordersResult.error.message)
    if (membersResult.error) throw new Error(membersResult.error.message)

    const rawOrders = (ordersResult.data ?? []) as Array<{
      id: string
      title: string
      deadline: string
      status: OrderSessionStatus
      created_at: string
    }>
    const orders: CircleHomeOrder[] = await Promise.all(
      rawOrders.map(async (order) => {
        const { count } = await supabase
          .from('order_entries')
          .select('id', { count: 'exact', head: true })
          .eq('order_session_id', order.id)
        return {
          id: order.id,
          title: order.title,
          deadline: order.deadline,
          status: order.status,
          statusLabel: ORDER_SESSION_STATUS_LABELS[order.status] ?? order.status,
          participantCount: count ?? 0,
          createdAt: order.created_at,
        }
      }),
    )

    const activeStatuses = new Set<OrderSessionStatus>(['open', 'closed', 'shopping', 'cooking'])
    const currentOrder = orders.find((order) => activeStatuses.has(order.status)) ?? null
    const archivedOrderIds = new Set(
      memories
        .map((memory) => memory.sourceOrderSessionId)
        .filter((orderId): orderId is string => Boolean(orderId)),
    )
    const latestCompletedOrder = orders.find(
      (order) => order.status === 'done' && !archivedOrderIds.has(order.id),
    )
    const memberRows = (membersResult.data ?? []) as unknown as Array<{
      user_id: string
      role: string
      profiles: { nickname: string } | null
    }>

    return NextResponse.json({
      ok: true,
      circle: accessResult.access.circle,
      myRole: accessResult.access.role,
      currentOrder,
      latestCompletedOrder: latestCompletedOrder ?? null,
      recentOrders: orders,
      memories,
      members: memberRows.map((member) => ({
        userId: member.user_id,
        nickname: member.profiles?.nickname ?? '饭搭子',
        role: member.role === 'owner' ? 'owner' : 'member',
        isMe: member.user_id === accessResult.access.userId,
      })),
    })
  } catch (err) {
    console.error('圈子今天工作台查询异常：', err)
    return NextResponse.json({ error: `加载圈子工作台失败：${(err as Error).message}` }, { status: 500 })
  }
}
