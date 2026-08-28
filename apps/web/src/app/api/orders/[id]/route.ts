import { NextResponse } from 'next/server'
import { createServerClient, getAuthUserId } from '@/lib/supabase'

interface OrderItemLike {
  recipeId?: string
  freeText?: string
  servings?: number
  note?: string
}

interface OrderDetailPayload {
  id: string
  title: string
  deadline: string
  status: string
  circleId: string | null
  circleName: string | null
  isHost: boolean
  entries: Array<{ nickname: string; items: OrderItemLike[] }>
  ingredientsSummary: Array<{ name: string; qty: number; unit: string }>
  /** recipeId → 菜谱名（用于明细展示，避免裸 UUID） */
  recipeTitles: Record<string, string>
  /** 当前有效的分享 token（仅发起人可见） */
  shareToken: string | null
}

/** 我发起的点单详情：校验 host 身份后才返回点单明细与分享 token */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getAuthUserId(request)
  if (!userId) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 })
  }

  const { id } = await params

  try {
    const supabase = createServerClient()

    const { data: session, error: sessionError } = await supabase
      .from('order_sessions')
      .select('id, title, deadline, status, host_id, circle_id, circles(name)')
      .eq('id', id)
      .maybeSingle()

    if (sessionError) {
      console.error('点单详情查询失败：', sessionError.message)
      return NextResponse.json({ error: '查询点单详情失败' }, { status: 500 })
    }
    if (!session) {
      return NextResponse.json({ error: '点单不存在或无权查看' }, { status: 404 })
    }

    // 发起人可看完整汇总；圈内成员只能看经过过滤的圈内订单内容
    let isHost = session.host_id === userId
    if (!isHost && session.circle_id) {
      const { data: membership, error: membershipError } = await supabase
        .from('circle_members')
        .select('user_id')
        .eq('circle_id', session.circle_id)
        .eq('user_id', userId)
        .maybeSingle()
      if (membershipError) throw new Error(membershipError.message)
      isHost = Boolean(membership)
    }
    if (!isHost) {
      return NextResponse.json({ error: '点单不存在或无权查看' }, { status: 404 })
    }
    const isSessionHost = session.host_id === userId
    const { data: entriesData } = await supabase
      .from('order_entries')
      .select('orderer_nickname, items')
      .eq('order_session_id', id)

    const entries = (entriesData ?? []).map((entry) => {
      const row = entry as { orderer_nickname: string; items: OrderItemLike[] }
      return { nickname: row.orderer_nickname, items: row.items ?? [] }
    })

    // 汇总食材（PRD §6.3：按份数倍乘后同名合并）
    const servingsByRecipe = new Map<string, number>()
    for (const entry of entries) {
      for (const item of entry.items) {
        if (item.recipeId) {
          const servings = item.servings ?? 1
          servingsByRecipe.set(item.recipeId, (servingsByRecipe.get(item.recipeId) ?? 0) + servings)
        }
      }
    }

    const ingredientsSummary: Array<{ name: string; qty: number; unit: string }> = []
    const recipeIdList = Array.from(servingsByRecipe.keys())
    if (recipeIdList.length > 0) {
      const { data: recipeIngs, error: ingsError } = await supabase
        .from('recipe_ingredients')
        .select('recipe_id, qty, unit, ingredients(name)')
        .in('recipe_id', recipeIdList)

      if (ingsError) {
        console.error('食材汇总查询失败：', ingsError.message)
      } else {
        const rows = (recipeIngs ?? []) as unknown as Array<{
          recipe_id: string
          qty: number | null
          unit: string | null
          ingredients: { name: string } | null
        }>
        const map = new Map<string, { qty: number; unit: string }>()
        for (const row of rows) {
          const name = row.ingredients?.name
          if (!name) continue
          // 该菜谱被点的总份数作为倍乘系数；无定量标注为 0（展示为「适量」）
          const factor = servingsByRecipe.get(row.recipe_id) ?? 1
          const amount = (Number(row.qty) || 0) * factor
          const current = map.get(name) || { qty: 0, unit: row.unit || '' }
          current.qty += amount
          map.set(name, current)
        }
        for (const [name, val] of map.entries()) {
          ingredientsSummary.push({ name, qty: val.qty, unit: val.unit })
        }
      }
    }

    const safeEntries = isSessionHost
      ? entries
      : entries.map((entry) => ({
          nickname: entry.nickname,
          items: entry.items.map(({ note: _note, ...item }) => item),
        }))

    // 圈友只需要看到选了什么，不应读取忌口备注或采购汇总
    const visibleIngredientsSummary = isSessionHost ? ingredientsSummary : []

    const { data: tokenRow } = isSessionHost
      ? await supabase
          .from('share_tokens')
          .select('token')
          .eq('order_session_id', id)
          .eq('revoked', false)
          .gt('expires_at', new Date().toISOString())
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
      : { data: null }

    // 点单明细里被点菜谱的 id → 菜名映射（避免页面展示裸 UUID）
    const recipeTitles: Record<string, string> = {}
    if (recipeIdList.length > 0) {
      const { data: titleRows } = await supabase
        .from('recipes')
        .select('id, title')
        .in('id', recipeIdList)
      for (const row of (titleRows ?? []) as Array<{ id: string; title: string }>) {
        recipeTitles[row.id] = row.title
      }
    }

    const payload: OrderDetailPayload = {
      id: session.id,
      title: session.title,
      deadline: session.deadline,
      status: session.status,
      circleId: session.circle_id ?? null,
      circleName: ((session.circles as unknown as Array<{ name: string }> | null)?.[0]?.name) ?? null,
      isHost: isSessionHost,
      entries: safeEntries,
      ingredientsSummary: visibleIngredientsSummary,
      recipeTitles,
      shareToken: isSessionHost ? (tokenRow?.token ?? null) : null,
    }

    return NextResponse.json(payload)
  } catch (err) {
    console.error('点单详情异常：', err)
    return NextResponse.json({ error: `系统异常：${(err as Error).message}` }, { status: 500 })
  }
}
