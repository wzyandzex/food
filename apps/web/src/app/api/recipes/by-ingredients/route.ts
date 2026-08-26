import { NextResponse } from 'next/server'
import { SAMPLE_RECIPES } from '@kaifan/shared'
import { createServerClient, isSupabaseConfigured } from '@/lib/supabase'

export interface FridgeMatch {
  id: string
  title: string
  minutes: number
  difficulty: number
  tags: string[]
  coverUrl?: string
  haveNames: string[]
  missNames: string[]
}

interface RecipeAggRow {
  id: string
  title: string
  minutes: number
  difficulty: number
  tags: string[] | null
  cover_url: string | null
  recipe_ingredients: Array<{
    optional: boolean
    ingredients: { name: string }[] | null
  }> | null
}

/** 用户输入与库名双向包含（「五花肉」匹配「带皮五花肉」，反之亦然） */
function nameMatches(input: string, dbName: string): boolean {
  const a = input.replace(/\s+/g, '')
  const b = dbName.replace(/\s+/g, '')
  if (!a || !b) return false
  return b.includes(a) || a.includes(b)
}

function rankAndBuild(
  /** key = recipeKey, value = 聚合的食材名列表 */
  candidates: Map<string, { meta: Omit<FridgeMatch, 'haveNames' | 'missNames'>; items: Array<{ name: string; optional: boolean }> }>,
  inputs: string[],
): FridgeMatch[] {
  const scored: Array<FridgeMatch & { ratio: number }> = []

  for (const { meta, items } of candidates.values()) {
    const haveNames: string[] = []
    const missNames: string[] = []

    for (const item of items) {
      const matched = inputs.some((input) => nameMatches(input, item.name))
      if (matched) haveNames.push(item.name)
      else if (!item.optional) missNames.push(item.name)
    }

    if (haveNames.length === 0) continue

    // 命中率以「必选食材」为分母（optional 缺失不扣分）
    scored.push({
      ...meta,
      haveNames,
      missNames,
      ratio: haveNames.length / Math.max(1, haveNames.length + missNames.length),
    })
  }

  return scored
    .sort((a, b) => {
      if (b.haveNames.length !== a.haveNames.length) return b.haveNames.length - a.haveNames.length
      if (b.ratio !== a.ratio) return b.ratio - a.ratio
      return a.minutes - b.minutes
    })
    .slice(0, 30)
    .map(({ ratio: _ratio, ...match }) => match)
}

/** 清冰箱按食材搜索：无需登录，公开已发布菜谱目录 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { ingredients?: unknown } | null
  const rawInputs = Array.isArray(body?.ingredients) ? body.ingredients : []
  const inputs = rawInputs
    .filter((name): name is string => typeof name === 'string')
    .map((name) => name.trim())
    .filter(Boolean)
    .slice(0, 12)

  if (inputs.length === 0) {
    return NextResponse.json({ error: '请至少输入一种现有食材' }, { status: 400 })
  }

  // 未配置数据库：对样例数据内存匹配降级
  if (!isSupabaseConfigured()) {
    const sampleCandidates = SAMPLE_RECIPES.map((recipe) => ({
      meta: {
        id: recipe.title,
        title: recipe.title,
        minutes: recipe.minutes,
        difficulty: recipe.difficulty,
        tags: recipe.tags,
      },
      items: recipe.ingredients.map((ing) => ({ name: ing.name, optional: ing.optional })),
    }))
    const map = new Map(sampleCandidates.map((c) => [c.meta.id, c]))
    return NextResponse.json({ ok: true, source: 'sample', matches: rankAndBuild(map, inputs) })
  }

  try {
    const supabase = createServerClient()
    const { data, error } = await supabase
      .from('recipes')
      .select('id, title, minutes, difficulty, tags, cover_url, recipe_ingredients(optional, ingredients(name))')
      .eq('status', 'published')
      .is('deleted_at', null)
      .limit(1000)

    if (error) throw new Error(error.message)

    const rows = (data ?? []) as RecipeAggRow[]
    const map = new Map(
      rows.map((row) => [
        row.id,
        {
          meta: {
            id: row.id,
            title: row.title,
            minutes: row.minutes,
            difficulty: row.difficulty,
            tags: row.tags ?? [],
            coverUrl: row.cover_url ?? undefined,
          },
          items: (row.recipe_ingredients ?? []).map((item) => ({
            name: item.ingredients?.[0]?.name ?? '',
            optional: item.optional,
          })).filter((item) => item.name),
        },
      ]),
    )

    return NextResponse.json({ ok: true, source: 'db', matches: rankAndBuild(map, inputs) })
  } catch (err) {
    console.error('清冰箱搜索异常：', err)
    return NextResponse.json({ error: `系统异常：${(err as Error).message}` }, { status: 500 })
  }
}
