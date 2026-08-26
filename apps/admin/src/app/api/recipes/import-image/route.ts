import { NextResponse } from 'next/server'
import { safeParseRecipe, formatRecipeIssues } from '@kaifan/shared'

import { saveRecipe } from '@/lib/recipe-importer'
import {
  chatCompletion,
  extractJson,
  isLlmConfigured,
  llmConfigError,
} from '@/lib/llm-client'
import { RECIPE_EXTRACTION_SYSTEM_PROMPT } from '@/lib/extraction-prompts'

export const maxDuration = 60

const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const MAX_IMAGE_BYTES = 5 * 1024 * 1024

/** OCR 图片导入：视觉模型识别菜谱照片（书本/手写/截图）→ recipe.v1 → 暂存待审核 */
export async function POST(request: Request) {
  if (!isLlmConfigured()) {
    return NextResponse.json({ error: llmConfigError() }, { status: 503 })
  }

  const formData = await request.formData()
  const image = formData.get('image')
  if (!(image instanceof File)) {
    return NextResponse.json({ error: '请上传菜谱图片' }, { status: 400 })
  }
  if (!ALLOWED_IMAGE_TYPES.has(image.type)) {
    return NextResponse.json({ error: '仅支持 JPG / PNG / WebP 图片（iOS 相册请选「存储到文件」转存或截图后上传）' }, { status: 400 })
  }
  if (image.size > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: '图片不能超过 5MB，建议先裁剪只保留文字部分' }, { status: 400 })
  }

  const base64 = Buffer.from(await image.arrayBuffer()).toString('base64')
  const dataUrl = `data:${image.type};base64,${base64}`

  const visionMessages = [
    { role: 'system' as const, content: RECIPE_EXTRACTION_SYSTEM_PROMPT },
    {
      role: 'user' as const,
      content: [
        {
          type: 'text' as const,
          text: '请把这张图片中的菜谱内容转换为 JSON（字段契约见系统指令）。图片里没有完整菜谱时只返回 {"notRecipe": true}。',
        },
        { type: 'image_url' as const, image_url: { url: dataUrl } },
      ],
    },
  ]

  let extracted: Record<string, unknown> | null
  try {
    const raw = await chatCompletion(visionMessages, {
      model: process.env.LLM_VISION_MODEL || undefined,
      jsonMode: true,
      timeoutMs: 55_000,
    })
    extracted = extractJson(raw)
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 })
  }

  if (!extracted) {
    return NextResponse.json({ error: '视觉模型输出无法解析为 JSON，请重拍一张更清晰的照片重试' }, { status: 502 })
  }
  if (extracted.notRecipe === true) {
    return NextResponse.json(
      { error: '未能从图片中识别出完整菜谱——请确认照片包含菜名、食材和步骤，且文字清晰可读' },
      { status: 422 },
    )
  }

  extracted.schemaVersion = 'recipe.v1'
  extracted.sourceType = 'ocr'

  const validation = safeParseRecipe(extracted)
  if (!validation.success) {
    return NextResponse.json(
      { error: `识别结果未通过 recipe.v1 校验：${formatRecipeIssues(validation.error).join('；')}。可尝试更清晰的照片` },
      { status: 422 },
    )
  }

  const result = await saveRecipe(validation.data, { status: 'pending' })
  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    summary: {
      title: validation.data.title,
      ingredientCount: validation.data.ingredients.length,
      stepCount: validation.data.steps.length,
      minutes: validation.data.minutes,
    },
    message: `${result.message}（OCR 识别，请人工核对后上架）`,
  })
}
