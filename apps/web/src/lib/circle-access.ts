import { createServerClient, getAuthUserId } from '@/lib/supabase'

export interface CircleAccess {
  userId: string
  circleId: string
  role: 'owner' | 'member'
  circle: { id: string; name: string; ownerId: string }
}

export type CircleAccessResult =
  | { ok: true; access: CircleAccess }
  | { ok: false; status: 401 | 403 | 404 | 500; error: string }

/** 统一圈子成员授权。Route Handler 使用 service role，因此每次写操作都必须显式经过这里。 */
export async function requireCircleAccess(
  request: Request,
  circleId: string,
): Promise<CircleAccessResult> {
  const userId = await getAuthUserId(request)
  if (!userId) return { ok: false, status: 401, error: '请先登录' }

  try {
    const supabase = createServerClient()
    const [{ data: membership, error: membershipError }, { data: circle, error: circleError }] =
      await Promise.all([
        supabase
          .from('circle_members')
          .select('role')
          .eq('circle_id', circleId)
          .eq('user_id', userId)
          .maybeSingle(),
        supabase
          .from('circles')
          .select('id, name, owner_id')
          .eq('id', circleId)
          .maybeSingle(),
      ])

    if (membershipError) throw new Error(membershipError.message)
    if (circleError) throw new Error(circleError.message)
    if (!circle || !membership) {
      return { ok: false, status: 403, error: '圈子不存在或你还不是成员' }
    }

    return {
      ok: true,
      access: {
        userId,
        circleId,
        role: membership.role === 'owner' ? 'owner' : 'member',
        circle: { id: circle.id, name: circle.name, ownerId: circle.owner_id },
      },
    }
  } catch (err) {
    console.error('圈子成员校验异常：', err)
    return { ok: false, status: 500, error: '圈子权限校验失败' }
  }
}

export async function requireCircleMealAccess(
  request: Request,
  memoryId: string,
): Promise<CircleAccessResult> {
  const userId = await getAuthUserId(request)
  if (!userId) return { ok: false, status: 401, error: '请先登录' }

  try {
    const supabase = createServerClient()
    const { data: memory, error: memoryError } = await supabase
      .from('circle_meal_memories')
      .select('circle_id')
      .eq('id', memoryId)
      .maybeSingle()
    if (memoryError) throw new Error(memoryError.message)
    if (!memory?.circle_id) return { ok: false, status: 404, error: '餐桌档案不存在' }

    const { data: membership, error: membershipError } = await supabase
      .from('circle_members')
      .select('role')
      .eq('circle_id', memory.circle_id)
      .eq('user_id', userId)
      .maybeSingle()
    if (membershipError) throw new Error(membershipError.message)

    const { data: circle, error: circleError } = await supabase
      .from('circles')
      .select('id, name, owner_id')
      .eq('id', memory.circle_id)
      .maybeSingle()
    if (circleError) throw new Error(circleError.message)
    if (!circle || !membership) return { ok: false, status: 403, error: '你已不在这个圈子，无法查看餐桌档案' }

    return {
      ok: true,
      access: {
        userId,
        circleId: circle.id,
        role: membership.role === 'owner' ? 'owner' : 'member',
        circle: { id: circle.id, name: circle.name, ownerId: circle.owner_id },
      },
    }
  } catch (err) {
    console.error('餐桌档案权限校验异常：', err)
    return { ok: false, status: 500, error: '餐桌档案权限校验失败' }
  }
}
