import { NextResponse } from 'next/server'
import { MEAL_TYPES, toLocalDateKey, type CookingStats, type MealType } from '@kaifan/shared'
import { createServerClient, getAuthUserId, isSupabaseConfigured } from '@/lib/supabase'

interface SessionRow {
  id: string
  date: string
  meal_type: string
  rating: number | null
  order_session_id: string | null
}

interface DishRow {
  session_id: string
  snapshot_title: string
  recipe_id: string | null
  photos: string[]
}

interface SessionWithDishes extends SessionRow {
  cook_dishes: DishRow[] | null
}

/** 连续做饭天数：distinct date 排序后线性扫描，计算当前连续段与最长连续段 */
function computeStreaks(distinctDates: string[]): { current: number; longest: number } {
  if (distinctDates.length === 0) return { current: 0, longest: 0 }

  // date 字符串（YYYY-MM-DD）字典序即时间序
  let longest = 1
  let run = 1

  for (let i = 1; i < distinctDates.length; i += 1) {
    const prevMs = Date.parse(`${distinctDates[i - 1]}T00:00:00`)
    const currMs = Date.parse(`${distinctDates[i]}T00:00:00`)
    const gapDays = Math.round((currMs - prevMs) / 86_400_000)
    if (gapDays === 1) {
      run += 1
      longest = Math.max(longest, run)
    } else if (gapDays > 1) {
      run = 1
    }
    // gapDays === 0 不可能出现（已去重）
  }

  // 当前连续段：从最后一天往前数
  let current = 1
  for (let i = distinctDates.length - 1; i > 0; i -= 1) {
    const prevMs = Date.parse(`${distinctDates[i - 1]}T00:00:00`)
    const currMs = Date.parse(`${distinctDates[i]}T00:00:00`)
    if (Math.round((currMs - prevMs) / 86_400_000) === 1) current += 1
    else break
  }

  // 若最后做饭日期距今天超过 1 天，「当前连续」实际已中断，归零
  const today = toLocalDateKey(new Date())
  const lastDay = distinctDates[distinctDates.length - 1]
  const daysSinceLast = Math.round((Date.parse(`${today}T00:00:00`) - Date.parse(`${lastDay}T00:00:00`)) / 86_400_000)
  if (daysSinceLast > 1) current = 0

  return { current, longest }
}

/** 做饭统计看板聚合接口（PRD §4.3） */
export async function GET(request: Request) {
  const userId = await getAuthUserId(request)
  if (!userId) {
    return NextResponse.json({ error: '请先登录后查看统计' }, { status: 401 })
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: '数据库未配置' }, { status: 503 })
  }

  try {
    const supabase = createServerClient()

    // 一次查询：顿次 + 嵌套菜品（FK 嵌入），RLS 已限定本人；limit 上限防止长期全量拉取
    const { data: rows, error: queryError } = await supabase
      .from('cook_sessions')
      .select('id, date, meal_type, rating, order_session_id, cook_dishes(session_id, snapshot_title, recipe_id, photos)')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .limit(1000)

    if (queryError) throw new Error(queryError.message)

    const typedRows = (rows ?? []) as unknown as SessionWithDishes[]
    const sessions = typedRows.map(({ cook_dishes, ...rest }) => rest)
    const dishes = typedRows.flatMap((row) => row.cook_dishes ?? [])

    const now = new Date()
    const thisMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

    // ===== 基础计数 =====
    const monthSessions = sessions.filter((s) => s.date.startsWith(thisMonthPrefix))
    const ratings = sessions.map((s) => s.rating).filter((r): r is number => typeof r === 'number')
    const orderLinked = sessions.filter((s) => s.order_session_id != null).length

    // ===== Top10 最常做的菜（按快照标题聚合；记录一个可跳转的 recipeId）=====
    const dishCounter = new Map<string, { count: number; recipeIds: Set<string> }>()
    const firstSeenMonth = new Map<string, string>()

    for (const dish of dishes) {
      const title = dish.snapshot_title?.trim()
      if (!title) continue
      const entry = dishCounter.get(title)
      if (entry) {
        entry.count += 1
        if (dish.recipe_id) entry.recipeIds.add(dish.recipe_id)
      } else {
        dishCounter.set(title, { count: 1, recipeIds: dish.recipe_id ? new Set([dish.recipe_id]) : new Set() })
      }
    }

    const sessionIdToDate = new Map(sessions.map((s) => [s.id, s.date]))
    for (const dish of dishes) {
      const title = dish.snapshot_title?.trim()
      const month = sessionIdToDate.get(dish.session_id)?.slice(0, 7)
      if (title && month && !firstSeenMonth.has(title)) firstSeenMonth.set(title, month)
    }

    const topDishes = Array.from(dishCounter.entries())
      .map(([title, entry]) => ({
        title,
        count: entry.count,
        recipeId: entry.recipeIds.values().next().value ?? undefined,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    const newDishCount = dishCounter.size
    const thisMonthNewDishes = Array.from(firstSeenMonth.values()).filter((m) => m === thisMonthPrefix).length

    // ===== 热量估算：dish→菜谱每份 calories 累计（PRD §4.2 健身人群口径）=====
    let totalCalories: number | null = null
    let monthCalories: number | null = null
    const referencedRecipeIds = new Set(
      dishes.map((d) => d.recipe_id).filter((id): id is string => Boolean(id)),
    )
    if (referencedRecipeIds.size > 0) {
      const { data: nutritionRows, error: nutritionError } = await supabase
        .from('recipes')
        .select('id, nutrition->>calories')
        .in('id', Array.from(referencedRecipeIds))

      if (nutritionError) throw new Error(nutritionError.message)

      const caloriesByRecipe = new Map<string, number>()
      for (const row of (nutritionRows ?? []) as Array<{ id: string; calories: string | number | null }>) {
        const kcal = typeof row.calories === 'string' ? Number(row.calories) : row.calories
        if (typeof kcal === 'number' && kcal > 0) caloriesByRecipe.set(row.id, kcal)
      }

      if (caloriesByRecipe.size > 0) {
        let total = 0
        let monthTotal = 0
        for (const dish of dishes) {
          if (!dish.recipe_id) continue
          const kcal = caloriesByRecipe.get(dish.recipe_id)
          if (kcal == null) continue
          total += kcal
          const dishMonth = sessionIdToDate.get(dish.session_id)?.slice(0, 7)
          if (dishMonth === thisMonthPrefix) monthTotal += kcal
        }
        totalCalories = total
        monthCalories = monthTotal
      }
    }

    // ===== 餐次分布 =====
    const mealTypeDist: Record<MealType, number> = { breakfast: 0, lunch: 0, dinner: 0, supper: 0 }
    for (const s of sessions) {
      if ((MEAL_TYPES as readonly string[]).includes(s.meal_type)) {
        mealTypeDist[s.meal_type as MealType] += 1
      }
    }

    // ===== 月度趋势：近 N 月补零填充 =====
    const monthsParam = Number(new URL(request.url).searchParams.get('months') ?? '6')
    const trendMonths = Math.min(12, Math.max(1, Number.isFinite(monthsParam) ? Math.floor(monthsParam) : 6))
    const monthlyTrend: Array<{ month: string; sessions: number }> = []
    for (let offset = trendMonths - 1; offset >= 0; offset -= 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - offset, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      monthlyTrend.push({ month: key, sessions: 0 })
    }
    const trendIndex = new Map(monthlyTrend.map((row) => [row.month, row]))
    for (const row of sessions) {
      const bucket = trendIndex.get(row.date.slice(0, 7))
      if (bucket) bucket.sessions += 1
    }

    // ===== 连续天数 =====
    const distinctDates = Array.from(new Set(sessions.map((s) => s.date))).sort()
    const { current, longest } = computeStreaks(distinctDates)

    const stats: CookingStats = {
      totals: {
        monthCount: monthSessions.length,
        totalSessions: sessions.length,
        totalDishes: dishes.length,
        totalPhotos: dishes.reduce((sum, d) => sum + (Array.isArray(d.photos) ? d.photos.length : 0), 0),
        avgRating: ratings.length > 0 ? Number((ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1)) : null,
        orderLinkedRatio: sessions.length > 0 ? Number((orderLinked / sessions.length).toFixed(2)) : null,
        monthCalories,
        totalCalories,
      },
      streaks: { currentStreakDays: current, longestStreakDays: longest },
      newDishCount,
      thisMonthNewDishes,
      topDishes,
      mealTypeDist,
      monthlyTrend,
    }

    return NextResponse.json({ ok: true, stats })
  } catch (err) {
    console.error('统计看板聚合异常：', err)
    return NextResponse.json({ error: `系统异常：${(err as Error).message}` }, { status: 500 })
  }
}
