import { safeParseRecipe, formatRecipeIssues, type RecipeV1 } from '@kaifan/shared'
import {
  chatCompletion,
  extractJson,
  isLlmConfigured,
  type ChatMessage,
} from '@/lib/llm-client'
import { RECIPE_EXTRACTION_SYSTEM_PROMPT } from '@/lib/extraction-prompts'

export function generateRecipeStub(dishName: string): RecipeV1 {
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

export async function generateSingleRecipe(dishName: string): Promise<RecipeV1> {
  const useLlm = await isLlmConfigured()
  if (!useLlm) {
    return generateRecipeStub(dishName)
  }

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
