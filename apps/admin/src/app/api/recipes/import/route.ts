import { NextResponse } from 'next/server'
import { safeParseRecipe, formatRecipeIssues, type RecipeV1 } from '@kaifan/shared'

import { saveRecipe } from '@/lib/recipe-importer'

interface ImportItemReport {
  title: string
  ok: boolean
  message: string
  recipeId?: string
}

/** 校验并暂存 JSON 菜谱（单条或数组），进入 pending 待确认队列（PRD §4.2 两段式第一段） */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as unknown
  if (body == null) {
    return NextResponse.json({ ok: false, message: '请求体不是合法 JSON' }, { status: 400 })
  }

  const candidates: unknown[] = Array.isArray(body) ? body : [body]
  const results: ImportItemReport[] = []
  let stagedCount = 0

  for (const candidate of candidates) {
    const parsed = safeParseRecipe(candidate)
    if (!parsed.success) {
      results.push({
        title: (candidate as { title?: string })?.title ?? '(未命名)',
        ok: false,
        message: formatRecipeIssues(parsed.error).join('；'),
      })
      continue
    }

    // safeParse 成功后直接复用 parsed.data，不进行冗余的二次解析
    const recipe: RecipeV1 = parsed.data
    const result = await saveRecipe(recipe, { status: 'pending' })
    if (result.ok) stagedCount += 1
    results.push({
      title: recipe.title,
      ok: result.ok,
      message: result.message,
      recipeId: result.recipeId,
    })
  }

  return NextResponse.json({
    ok: stagedCount > 0,
    stagedCount,
    results,
  })
}
