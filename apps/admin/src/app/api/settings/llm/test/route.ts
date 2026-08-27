import { NextResponse } from 'next/server'
import { chatCompletion, getResolvedLlmConfig } from '@/lib/llm-client'

export const maxDuration = 60

/** 测试当前动态配置或指定传入配置的连通性 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    baseUrl?: string
    apiKey?: string
    model?: string
  } | null

  try {
    const activeConfig = await getResolvedLlmConfig()
    const testBaseUrl = body?.baseUrl?.trim()?.replace(/\/+$/, '') || activeConfig.baseUrl
    const testKey = body?.apiKey?.trim() || activeConfig.apiKey
    const testModel = body?.model?.trim() || activeConfig.model

    if (!testKey) {
      return NextResponse.json({ error: '尚未提供 API Key，无法测试' }, { status: 400 })
    }

    // 发起一次极简测试对话
    const startTime = Date.now()
    const response = await fetch(`${testBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${testKey}`,
      },
      body: JSON.stringify({
        model: testModel,
        messages: [
          { role: 'user', content: '请回复四个字：开饭成功' },
        ],
        temperature: 0.1,
      }),
    })

    const latencyMs = Date.now() - startTime

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      return NextResponse.json(
        { error: `连接失败（HTTP ${response.status}）：${text.slice(0, 200)}` },
        { status: 400 },
      )
    }

    const json = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> }
    const reply = json.choices?.[0]?.message?.content?.trim() || '（无回复内容）'

    return NextResponse.json({
      ok: true,
      model: testModel,
      latencyMs,
      reply,
      message: `连通性测试成功！耗时 ${latencyMs}ms，模型回复：「${reply}」`,
    })
  } catch (err) {
    return NextResponse.json({ error: `测试异常：${(err as Error).message}` }, { status: 500 })
  }
}
