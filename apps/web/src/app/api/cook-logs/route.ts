import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

interface DishInput {
  recipeId?: string
  snapshotTitle: string
  snapshotCover?: string
  photos?: string[]
  adjustNote?: string
}

/** 保存一顿做饭记录（CookSession + 多道菜 CookDish） */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    userId?: string
    date?: string
    mealType?: string
    note?: string
    rating?: number
    orderSessionId?: string
    dishes?: DishInput[]
  } | null

  if (!body?.userId || !body.date || !body.mealType) {
    return NextResponse.json({ error: '缺少必填字段（userId, date, mealType）' }, { status: 400 })
  }

  if (!Array.isArray(body.dishes) || body.dishes.length === 0) {
    return NextResponse.json({ error: '一顿饭至少记录一道菜' }, { status: 400 })
  }

  try {
    const supabase = createServerClient()

    // 1. 插入顿会话 CookSession
    const { data: sessionData, error: sessionError } = await supabase
      .from('cook_sessions')
      .insert({
        user_id: body.userId,
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

    // 2. 插入每道菜 CookDish（含快照抗删除）
    const dishRows = body.dishes.map((d) => ({
      session_id: sessionId,
      recipe_id: d.recipeId || null,
      snapshot_title: d.snapshotTitle,
      snapshot_cover: d.snapshotCover || null,
      photos: d.photos || [],
      adjust_note: d.adjustNote || null,
    }))

    const { error: dishError } = await supabase.from('cook_dishes').insert(dishRows)

    if (dishError) {
      return NextResponse.json({ error: `菜品保存失败：${dishError.message}` }, { status: 500 })
    }

    return NextResponse.json({ ok: true, sessionId })
  } catch (err) {
    return NextResponse.json({ error: `系统异常：${(err as Error).message}` }, { status: 500 })
  }
}
