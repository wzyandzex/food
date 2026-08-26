import { NextResponse } from 'next/server'
import { safeParseRecipe, formatRecipeIssues } from '@kaifan/shared'

import { saveRecipe } from '@/lib/recipe-importer'
import { htmlToText, isLikelyUsefulText } from '@/lib/html-text'
import {
  chatCompletion,
  extractJson,
  isLlmConfigured,
  llmConfigError,
} from '@/lib/llm-client'
import {
  RECIPE_EXTRACTION_SYSTEM_PROMPT,
  buildExtractionUserPrompt,
} from '@/lib/extraction-prompts'

export const maxDuration = 60

/** SSRF 防护：拒绝内网/环回/链路本地地址 */
function isBlockedHost(hostname: string): boolean {
  return (
    hostname === 'localhost' ||
    hostname.endsWith('.local') ||
    /^127\./.test(hostname) ||
    /^10\./.test(hostname) ||
    /^192\.168\./.test(hostname) ||
    /^169\.254\./.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(hostname) ||
    hostname === '0.0.0.0' ||
    hostname === '::1' ||
    hostname === '[::1]'
  )
}

interface ExtractedRecipe extends Record<string, unknown> {
  notRecipe?: boolean
}

/** 从 LLM 输出解析菜谱 JSON；一次纠错重试。返回 null 表示彻底失败。 */
async function parseExtractionResult(
  messages: Parameters<typeof chatCompletion>[0],
  raw: string,
): Promise<ExtractedRecipe | null> {
  const parsed = extractJson(raw)
  if (parsed) return parsed as ExtractedRecipe

  // 纠错重试
  const retryRaw = await chatCompletion(
    [
      ...messages,
      {
        role: 'assistant' as const,
        content: raw.slice(0, 500),
      },
      {
        role: 'user' as const,
        content: '你上一条输出不是合法 JSON。请重新只输出一个合法 JSON 对象，不要任何多余文字。',
      },
    ],
    { timeoutMs: 45_000 },
  )
  return extractJson(retryRaw) as ExtractedRecipe | null
}

export async function POST(request: Request) {
  if (!isLlmConfigured()) {
    return NextResponse.json({ error: llmConfigError() }, { status: 503 })
  }

  const body = (await request.json().catch(() => null)) as { url?: unknown } | null
  const url = typeof body?.url === 'string' ? body.url.trim() : ''

  let parsedUrl: URL
  try {
    parsedUrl = new URL(url)
  } catch {
    return NextResponse.json({ error: 'URL 格式不合法' }, { status: 400 })
  }
  if ((parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') || isBlockedHost(parsedUrl.hostname)) {
    return NextResponse.json({ error: '仅支持公网 http(s) 链接' }, { status: 400 })
  }

  // 抓取页面
  let html: string
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 15_000)
    const response = await fetch(parsedUrl.toString(), {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'zh-CN,zh;q=0.9',
      },
      redirect: 'follow',
      signal: controller.signal,
    })
    clearTimeout(timer)

    if (!response.ok) {
      return NextResponse.json({ error: `页面抓取失败（HTTP ${response.status}），该链接可能需要登录或已失效` }, { status: 400 })
    }

    const contentType = response.headers.get('content-type') ?? ''
    if (!contentType.includes('html') && !contentType.includes('text')) {
      return NextResponse.json({ error: `链接内容类型为 ${contentType.split(';')[0]}，不是网页文本` }, { status: 400 })
    }

    // 限制读取大小（1MB 足够覆盖正文）
    const reader = response.body?.getReader()
    if (!reader) {
      html = await response.text()
    } else {
      const chunks: Uint8Array[] = []
      let received = 0
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        chunks.push(value)
        received += value.length
        if (received > 1024 * 1024) {
          void reader.cancel()
          break
        }
      }
      html = new TextDecoder('utf-8').decode(concatChunks(chunks))
    }
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      return NextResponse.json({ error: '页面抓取超时（15 秒），站点可能不可达' }, { status: 504 })
    }
    return NextResponse.json({ error: `页面抓取失败：${(err as Error).message}` }, { status: 502 })
  }

  const text = htmlToText(html)
  if (!isLikelyUsefulText(text)) {
    return NextResponse.json(
      { error: '页面正文近乎为空——该页面很可能是 JS 动态渲染，无法直接抓取；可试试对页面截图走「图片 OCR 导入」' },
      { status: 422 },
    )
  }

  // LLM 抽取
  const messages = [
    { role: 'system' as const, content: RECIPE_EXTRACTION_SYSTEM_PROMPT },
    buildExtractionUserPrompt(text),
  ]

  let extracted: ExtractedRecipe | null
  try {
    const raw = await chatCompletion(messages, { jsonMode: true, timeoutMs: 55_000 })
    extracted = await parseExtractionResult(messages, raw)
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 })
  }

  if (!extracted) {
    return NextResponse.json({ error: 'LLM 输出无法解析为 JSON，请重试一次' }, { status: 502 })
  }
  if (extracted.notRecipe === true) {
    return NextResponse.json({ error: '无法从该页面识别出完整菜谱（可能是图集、视频或文章）。建议改用「图片 OCR 导入」或手动录入' }, { status: 422 })
  }

  // 强制署名与来源标记
  extracted.schemaVersion = 'recipe.v1'
  extracted.sourceType = 'url'
  extracted.sourceUrl = parsedUrl.toString()

  const validation = safeParseRecipe(extracted)
  if (!validation.success) {
    return NextResponse.json(
      { error: `抽取结果未通过 recipe.v1 校验：${formatRecipeIssues(validation.error).join('；')}` },
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
    message: `${result.message}（已署名原文链接）`,
  })
}

function concatChunks(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
  const merged = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    merged.set(chunk, offset)
    offset += chunk.length
  }
  return merged
}
