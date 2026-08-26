import { NextResponse } from 'next/server'
import { safeParseRecipe, formatRecipeIssues, type RecipeV1 } from '@kaifan/shared'

import { saveRecipe } from '@/lib/recipe-importer'
import {
  chatCompletion,
  extractJson,
  isLlmConfigured,
  llmConfigError,
} from '@/lib/llm-client'
import { RECIPE_EXTRACTION_SYSTEM_PROMPT } from '@/lib/extraction-prompts'
import type { ChatMessage } from '@/lib/llm-client'

interface GenerateRequest {
  dishNames?: string[]
}

/** LLM 生成结构化菜谱（PRD §4.2 渠道 4）：
 *  配置 LLM_API_KEY 时走真实模型；未配置时回退启发式 stub，保证功能始终可用。
 *  生成数据写入 pending 待确认队列，供人工抽检上架。 */
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
    sourceType: 'llm',
    authorNote: 'LLM 调研生成（当前为未配置模型时的本地模板），请人工核对后上架',
  }
}

async function generateWithLlm(dishName: string): Promise<RecipeV1> {
  const messages: ChatMessage[] = [
    { role: 'system', content: RECIPE_EXTRACTION_SYSTEM_PROMPT },
    {
      role: 'user',
      content: `请为家常菜「${dishName}」编写一份结构化菜谱 JSON：食材用量合理、步骤清晰可执行、总耗时符合实际。`,
    },
  ]
  const raw = await chatCompletion(messages, { jsonMode: true, timeoutMs: 55_000 })
  const extracted = extractJson(raw)
  if (!extracted || extracted.notRecipe === true) {
    throw new Error('模型未能生成有效菜谱')
  }

  extracted.schemaVersion = 'recipe.v1'
  extracted.sourceType = 'llm'
  extracted.authorNote = 'AI 生成内容，经人工审核前仅供参考'

  const validation = safeParseRecipe(extracted)
  if (!validation.success) {
    throw new Error(`模型输出未通过校验：${formatRecipeIssues(validation.error).join('；')}`)
  }
  return validation.data
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

  const useLlm = isLlmConfigured()
  const results: { title: string; ok: boolean; message: string; recipeId?: string }[] = []
  let stagedCount = 0

  for (const name of names) {
    let generated: RecipeV1
    if (useLlm) {
      try {
        generated = await generateWithLlm(name)
      } catch (err) {
        results.push({ title: name, ok: false, message: `LLM 生成失败：${(err as Error).message}` })
        continue
      }
    } else {
      generated = generateRecipeStub(name)
    }

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
      message: useLlm ? result.message : `${result.message}（未配置 LLM_API_KEY，当前为模板数据）`,
      recipeId: result.recipeId,
    })
  }

  return NextResponse.json({
    ok: stagedCount > 0,
    stagedCount,
    usedLlm: useLlm,
    hint: useLlm ? undefined : llmConfigHint(),
    results,
  })
}

function llmConfigHint(): string {
  return '当前使用本地模板生成（不是真实 AI）。配置 LLM_API_KEY 后将自动切换为真实大模型生成。'
}
