import { NextResponse } from 'next/server'
import { MEAL_TYPES, startOfWeek, toLocalDateKey, weekDates, type MealType } from '@kaifan/shared'
import { createServerClient, getAuthUserId } from '@/lib/supabase'

export interface MealPlanEntry {
  id: string
  planDate: string
  mealType: MealType
  recipeId: string | null
  snapshotTitle: string
  note: string | null
  status: 'planned' | 'cooked' | 'skipped'
}

function resolveWeek(anchor?: string): string[] {
  const base =
    anchor && /^\d{4}-\d{2}-\d{2}$/.test(anchor)
      ? new Date(Date.parse(`${anchor}T00:00:00`))
      : new Date()
  return Number.isNaN(base.getTime()) ? weekDates(startOfWeek()) : weekDates(startOfWeek(base))
}

/** 获取某自然周（锚点日所在周，周一起始）的排餐计划 */
export async function GET(request: Request) {
  const userId = await getAuthUserId(request)
  if (!userId) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 })
  }

  const anchor = new URL(request.url).searchParams.get('anchor') ?? undefined
  const dates = resolveWeek(anchor)

  try {
    const supabase = createServerClient()
    const { data, error } = await supabase
      .from('meal_plan_entries')
      .select('id, plan_date, meal_type, recipe_id, snapshot_title, note, status')
      .eq('user_id', userId)
      .gte('plan_date', dates[0])
      .lte('plan_date', dates[6])
      .order('plan_date', { ascending: true })

    if (error) throw new Error(error.message)

    const entries: MealPlanEntry[] = ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
      id: row.id as string,
      planDate: row.plan_date as string,
      mealType: row.meal_type as MealType,
      recipeId: (row.recipe_id as string | null) ?? null,
      snapshotTitle: row.snapshot_title as string,
      note: (row.note as string | null) ?? null,
      status: row.status as MealPlanEntry['status'],
    }))

    return NextResponse.json({ ok: true, weekDates: dates, entries })
  } catch (err) {
    console.error('排餐计划查询异常：', err)
    return NextResponse.json({ error: `系统异常：${(err as Error).message}` }, { status: 500 })
  }
}

/** 安排/覆盖一格：upsert（唯一键 user_id+plan_date+meal_type） */
export async function PUT(request: Request) {
  const userId = await getAuthUserId(request)
  if (!userId) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 })
  }

  const body = (await request.json().catch(() => null)) as {
    planDate?: unknown
    mealType?: unknown
    recipeId?: unknown
    snapshotTitle?: unknown
    note?: unknown
  } | null

  const planDate = typeof body?.planDate === 'string' ? body.planDate : ''
  const mealType = typeof body?.mealType === 'string' ? body.mealType : ''
  const snapshotTitle = typeof body?.snapshotTitle === 'string' ? body.snapshotTitle.trim() : ''

  if (!/^\d{4}-\d{2}-\d{2}$/.test(planDate)) {
    return NextResponse.json({ error: '日期格式不合法' }, { status: 400 })
  }
  if (!(MEAL_TYPES as readonly string[]).includes(mealType)) {
    return NextResponse.json({ error: '餐次不合法' }, { status: 400 })
  }
  if (!snapshotTitle || snapshotTitle.length > 80) {
    return NextResponse.json({ error: '请填写菜名（≤80 字）' }, { status: 400 })
  }

  try {
    const supabase = createServerClient()
    const { error } = await supabase.from('meal_plan_entries').upsert(
      {
        user_id: userId,
        plan_date: planDate,
        meal_type: mealType,
        recipe_id: typeof body?.recipeId === 'string' && body.recipeId.length > 0 ? body.recipeId : null,
        snapshot_title: snapshotTitle,
        note: typeof body?.note === 'string' && body.note.trim() ? body.note.trim() : null,
        status: 'planned',
      },
      { onConflict: 'user_id, plan_date, meal_type' },
    )

    if (error) throw new Error(error.message)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('排餐计划写入异常：', err)
    return NextResponse.json({ error: `系统异常：${(err as Error).message}` }, { status: 500 })
  }
}
