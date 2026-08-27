import { getAdminClient } from '@/lib/supabase'

export interface ResolvedLlmConfig {
  baseUrl: string
  apiKey: string
  model: string
  visionModel: string
  source: 'db' | 'env' | 'none'
}

/** 动态解析 LLM 配置：优先从 Supabase system_settings 读取，未填则回落 process.env */
export async function getResolvedLlmConfig(): Promise<ResolvedLlmConfig> {
  let dbKey = ''
  let dbBaseUrl = ''
  let dbModel = ''
  let dbVisionModel = ''

  try {
    const supabase = getAdminClient()
    const { data } = await supabase
      .from('system_settings')
      .select('key, value')
      .in('key', ['llm_api_key', 'llm_base_url', 'llm_model', 'llm_vision_model'])

    if (data && Array.isArray(data)) {
      for (const row of data) {
        if (row.key === 'llm_api_key') dbKey = (row.value ?? '').trim()
        if (row.key === 'llm_base_url') dbBaseUrl = (row.value ?? '').trim()
        if (row.key === 'llm_model') dbModel = (row.value ?? '').trim()
        if (row.key === 'llm_vision_model') dbVisionModel = (row.value ?? '').trim()
      }
    }
  } catch {
    // 数据库未配置或表尚未执行迁移时，静默回落环境变量
  }

  const apiKey = dbKey || (process.env.LLM_API_KEY ?? '').trim()
  const rawBaseUrl = dbBaseUrl || process.env.LLM_API_BASE_URL || 'https://open.bigmodel.cn/api/paas/v4'
  const baseUrl = rawBaseUrl.replace(/\/+$/, '')
  const model = dbModel || process.env.LLM_MODEL || 'glm-4-flash'
  const visionModel = dbVisionModel || process.env.LLM_VISION_MODEL || model || 'glm-4v-flash'

  return {
    baseUrl,
    apiKey,
    model,
    visionModel,
    source: dbKey ? 'db' : apiKey ? 'env' : 'none',
  }
}

export async function isLlmConfigured(): Promise<boolean> {
  const config = await getResolvedLlmConfig()
  return Boolean(config.apiKey)
}

export function llmConfigError(): string {
  return 'LLM 未配置：请在管理端「⚙️ 系统设置」页面或 Vercel 环境变量中配置 API Key'
}

interface ChatMessageText {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ChatMessageVision {
  role: 'user'
  content: Array<
    | { type: 'text'; text: string }
    | { type: 'image_url'; image_url: { url: string } }
  >
}

export type ChatMessage = ChatMessageText | ChatMessageVision

export interface ChatOptions {
  model?: string
  jsonMode?: boolean
  timeoutMs?: number
  isVision?: boolean
}

/** 执行一次对话补全：自动加载最新动态配置并调用 OpenAI 兼容端点 */
export async function chatCompletion(messages: ChatMessage[], options: ChatOptions = {}): Promise<string> {
  const config = await getResolvedLlmConfig()
  if (!config.apiKey) throw new Error(llmConfigError())

  const targetModel =
    options.model || (options.isVision ? config.visionModel : config.model) || config.model

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 55_000)

  try {
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: targetModel,
        messages,
        temperature: 0.2,
        ...(options.jsonMode ? { response_format: { type: 'json_object' } } : {}),
      }),
      signal: controller.signal,
    })

    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      throw new Error(`LLM 请求失败（HTTP ${response.status}，模型: ${targetModel}）：${detail.slice(0, 250)}`)
    }

    const body = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>
    }
    return body.choices?.[0]?.message?.content ?? ''
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      throw new Error('LLM 请求超时（55 秒），请检查网络或第三方 API 响应速度')
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
}

/** 从模型输出中稳健地提取 JSON 对象 */
export function extractJson(raw: string): Record<string, unknown> | null {
  const trimmed = raw.trim()

  try {
    return JSON.parse(trimmed) as Record<string, unknown>
  } catch {
    // 继续尝试围栏提取
  }

  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenceMatch?.[1]) {
    try {
      return JSON.parse(fenceMatch[1].trim()) as Record<string, unknown>
    } catch {
      // 降级到花括号截取
    }
  }

  const firstBrace = trimmed.indexOf('{')
  const lastBrace = trimmed.lastIndexOf('}')
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    try {
      return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1)) as Record<string, unknown>
    } catch {
      return null
    }
  }
  return null
}
