import { NextResponse } from 'next/server'
import { parseRecipe, safeParseRecipe, formatRecipeIssues, type RecipeV1 } from '@kaifan/shared'

import { importRecipe } from '@/lib/recipe-importer'

/** 校验并导入 JSON 菜谱（单条或数组），返回导入报告 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as unknown
  if (body == null) {
    return NextResponse.json({ ok: false, message: '请求体不是合法 JSON' }, { status: 400 })
  }

  const candidates: unknown[] = Array.isArray(body) ? body : [body]
  const results: { title: string; ok: boolean; message: string }[] = []
  let importedCount = 0

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

    const recipe: RecipeV1 = parseRecipe(candidate)
    const result = await importRecipe(recipe)
    if (result.ok) importedCount += result.importedCount ?? 0
    results.push({ title: recipe.title, ok: result.ok, message: result.message })
  }

  return NextResponse.json({
    ok: importedCount > 0,
    importedCount,
    results,
  })
}