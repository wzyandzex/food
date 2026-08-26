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
  entries: Array<{ nickname: string; items: OrderItemLike[] }>
  ingredientsSummary: Array<{ name: string; qty: number; unit: string }>
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
      .select('id, title, deadline, status, host_id')
      .eq('id', id)
      .maybeSingle()

    if (sessionError) {
      console.error('点单详情查询失败：', sessionError.message)
      return NextResponse.json({ error: '查询点单详情失败' }, { status: 500 })
    }
    // 不存在或不属于当前用户一律按未找到处理，不泄露他人会话
    if (!session || session.host_id !== userId) {
      return NextResponse.json({ error: '点单不存在或无权查看' }, { status: 404 })
    }

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

    // 分享链接仅对发起人暴露：取该会话未撤销且未过期的最新 token
    const { data: tokenRow } = await supabase
      .from('share_tokens')
      .select('token')
      .eq('order_session_id', id)
      .eq('revoked', false)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const payload: OrderDetailPayload = {
      id: session.id,
      title: session.title,
      deadline: session.deadline,
      status: session.status,
      entries,
      ingredientsSummary,
      shareToken: tokenRow?.token ?? null,
    }

    return NextResponse.json(payload)
  } catch (err) {
    console.error('点单详情异常：', err)
    return NextResponse.json({ error: `系统异常：${(err as Error).message}` }, { status: 500 })
  }
}
