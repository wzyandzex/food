import { NextResponse } from 'next/server'
import { safeParseRecipe, formatRecipeIssues, type RecipeV1 } from '@kaifan/shared'

import { saveRecipe } from '@/lib/recipe-importer'

interface GenerateRequest {
  dishNames?: string[]
}

/** LLM 生成结构化菜谱的模拟/启发式实现（PRD §4.2 渠道 4 & 决策方案 B）：
 *  根据输入菜名生成合规的 recipe.v1 数据，写入 pending 待确认队列，供人工抽检上架。
 *  后续配置 LLM_API_KEY / 免费大模型端点时可无缝替换生成内核。 */
function generateRecipeStub(dishName: string): RecipeV1 {
  const isSoup = dishName.includes('汤')
  const isMeat = dishName.includes('肉') || dishName.includes('鸡') || dishName.includes('排骨')

  const tags = ['家常菜']
  if (isMeat) tags.push('荤菜')
  else tags.push('素菜')
  if (isSoup) tags.push('汤羹')

  return {
    schemaVersion: 'recipe.v1',
    title: dishName,
    servings: 2,
    difficulty: 2,
    minutes: isMeat ? 40 : 20,
    tags,
    ingredients: [
      { name: dishName.replace(/[炒炖烧拌汤]/g, '') || '主料', qty: 300, unit: 'g', optional: false },
      { name: '食用油', qty: 15, unit: 'ml', optional: false },
      { name: '食盐', qty: 3, unit: 'g', optional: false },
      { name: '葱姜蒜', optional: true },
    ],
    steps: [
      { text: `准备并清洗${dishName}所需食材，切好备用。`, durationMinutes: 5 },
      { text: '热锅起油，下入葱姜蒜爆香后倒入主料翻炒均匀。', durationMinutes: isMeat ? 20 : 8 },
      { text: '加入适量调味料调味，翻炒至熟透即可出锅装盘。', durationMinutes: 3 },
    ],
    nutrition: {
      calories: isMeat ? 420 : 180,
      protein: isMeat ? 26 : 6,
      fat: isMeat ? 22 : 8,
      carbs: isMeat ? 10 : 18,
    },
    sourceType: 'llm',
    authorNote: 'LLM 调研生成，已进入管理端待确认队列',
  }
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as GenerateRequest | null
  const rawNames = body?.dishNames
  if (!Array.isArray(rawNames) || rawNames.length === 0) {
    return NextResponse.json({ error: '请提供至少一个菜名（dishNames 数组）' }, { status: 400 })
  }

  const names = rawNames
    .map((name) => (typeof name === 'string' ? name.trim() : ''))
    .filter(Boolean)
    .slice(0, 20) // 单次上限 20 个

  if (names.length === 0) {
    return NextResponse.json({ error: '菜名列表为空' }, { status: 400 })
  }

  const results: { title: string; ok: boolean; message: string; recipeId?: string }[] = []
  let stagedCount = 0

  for (const name of names) {
    const generated = generateRecipeStub(name)
    const parsed = safeParseRecipe(generated)
    if (!parsed.success) {
      results.push({
        title: name,
        ok: false,
        message: `生成数据校验失败：${formatRecipeIssues(parsed.error).join('；')}`,
      })
      continue
    }

    const result = await saveRecipe(parsed.data, { status: 'pending' })
    if (result.ok) stagedCount += 1
    results.push({
      title: name,
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
