import { NextResponse } from 'next/server'
import type { RecipeSnapshot } from '@kaifan/shared'
import { createServerClient, getAuthUserId } from '@/lib/supabase'

interface DishInput {
  recipeId?: string
  snapshotTitle: string
  snapshotCover?: string
  recipeSnapshot?: RecipeSnapshot
  photos?: string[]
  adjustNote?: string
}

/** 保存一顿做饭记录（CookSession + 多道菜 CookDish）。
 *  身份以 Authorization Bearer 为准，不信任请求体里的 userId。 */
export async function POST(request: Request) {
  const userId = await getAuthUserId(request)
  if (!userId) {
    return NextResponse.json({ error: '请先登录后再记录' }, { status: 401 })
  }

  const body = (await request.json().catch(() => null)) as {
    date?: string
    mealType?: string
    note?: string
    rating?: number
    orderSessionId?: string
    dishes?: DishInput[]
  } | null

  if (!body?.date || !body.mealType) {
    return NextResponse.json({ error: '缺少必填字段（date, mealType）' }, { status: 400 })
  }

  if (!Array.isArray(body.dishes) || body.dishes.length === 0) {
    return NextResponse.json({ error: '一顿饭至少记录一道菜' }, { status: 400 })
  }

  // rating 范围校验，避免靠 DB check 抛 500
  if (body.rating != null && (body.rating < 1 || body.rating > 5)) {
    return NextResponse.json({ error: '评分需在 1-5 星之间' }, { status: 400 })
  }

  try {
    const supabase = createServerClient()

    // 1. 插入顿会话 CookSession（user_id 取自已验证身份）
    const { data: sessionData, error: sessionError } = await supabase
      .from('cook_sessions')
      .insert({
        user_id: userId,
        date: body.date,
        meal_type: body.mealType,
        note: body.note || null,
        rating: body.rating || null,
        order_session_id: body.orderSessionId || null,
      })
      .select('id')
      .single()

    if (sessionError || !sessionData) {
      return NextResponse.json({ error: `记录创建失败：${sessionError?.message}` }, { status: 500 })
    }

    const sessionId = sessionData.id as string

    // 2. 插入每道菜 CookDish（含完整历史 JSONB 快照，抗菜谱修改与物理软删）
    const dishRows = body.dishes.map((d) => {
      const snapshot: RecipeSnapshot = d.recipeSnapshot || {
        id: d.recipeId,
        title: d.snapshotTitle,
        coverUrl: d.snapshotCover || null,
        servings: 2,
        difficulty: 2,
        minutes: 30,
        ingredients: [],
        steps: [],
        snapshotAt: new Date().toISOString(),
      }

      return {
        session_id: sessionId,
        recipe_id: d.recipeId || null,
        snapshot_title: d.snapshotTitle,
        snapshot_cover: d.snapshotCover || null,
        recipe_snapshot: snapshot,
        photos: d.photos || [],
        adjust_note: d.adjustNote || null,
      }
    })

    const { error: dishError } = await supabase.from('cook_dishes').insert(dishRows)

    if (dishError) {
      return NextResponse.json({ error: `菜品保存失败：${dishError.message}` }, { status: 500 })
    }

    return NextResponse.json({ ok: true, sessionId })
  } catch (err) {
    console.error('做饭记录保存异常：', err)
    return NextResponse.json({ error: `系统异常：${(err as Error).message}` }, { status: 500 })
  }
}
