/** OpenAI 兼容协议的轻量 LLM 客户端（零 SDK 依赖）。
 *  默认指向智谱开放平台免费模型：文本 glm-4-flash / 视觉 glm-4v-flash；
 *  换任何 OpenAI 兼容端点只需改环境变量。 */

const LLM_API_BASE_URL = (process.env.LLM_API_BASE_URL || 'https://open.bigmodel.cn/api/paas/v4').replace(/\/+$/, '')
const LLM_MODEL = process.env.LLM_MODEL || 'glm-4-flash'
const LLM_VISION_MODEL = process.env.LLM_VISION_MODEL || 'glm-4v-flash'

export function isLlmConfigured(): boolean {
  return Boolean(process.env.LLM_API_KEY)
}

export function llmConfigError(): string {
  return 'LLM 未配置：请在管理端环境变量中设置 LLM_API_KEY（可选 LLM_API_BASE_URL / LLM_MODEL / LLM_VISION_MODEL，推荐智谱 glm-4-flash 与 glm-4v-flash 免费模型）'
}

interface ChatMessageText {
  role: 'system' | 'user' | 'assistant'
  content: string
}

/** 视觉消息：content 支持图文混排（image_url 为 http(s) 或 dataURL） */
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
}

/** 执行一次对话补全，返回首个 choice 的文本内容 */
export async function chatCompletion(messages: ChatMessage[], options: ChatOptions = {}): Promise<string> {
  const apiKey = process.env.LLM_API_KEY
  if (!apiKey) throw new Error(llmConfigError())

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 45_000)

  try {
    const response = await fetch(`${LLM_API_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: options.model ?? LLM_MODEL,
        messages,
        temperature: 0.2,
        ...(options.jsonMode ? { response_format: { type: 'json_object' } } : {}),
      }),
      signal: controller.signal,
    })

    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      throw new Error(`LLM 请求失败（HTTP ${response.status}）：${detail.slice(0, 200)}`)
    }

    const body = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>
    }
    return body.choices?.[0]?.message?.content ?? ''
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      throw new Error('LLM 请求超时，请稍后重试或换用更快的模型')
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
}

/** 从模型输出中稳健地提取 JSON 对象（容忍 ```json 围栏与前后噪声文本） */
export function extractJson(raw: string): Record<string, unknown> | null {
  const trimmed = raw.trim()

  // 直接解析
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
      // 落到花括号兜底
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
