import { NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase'
import { getResolvedLlmConfig } from '@/lib/llm-client'

/** 查询当前 LLM 配置（对 API Key 做脱敏） */
export async function GET() {
  try {
    const config = await getResolvedLlmConfig()
    const maskedKey = config.apiKey
      ? config.apiKey.length > 8
        ? `${config.apiKey.slice(0, 4)}••••••••${config.apiKey.slice(-4)}`
        : '••••••••'
      : ''

    return NextResponse.json({
      ok: true,
      config: {
        baseUrl: config.baseUrl,
        model: config.model,
        visionModel: config.visionModel,
        hasKey: Boolean(config.apiKey),
        maskedKey,
        source: config.source,
      },
    })
  } catch (err) {
    return NextResponse.json({ error: `查询失败：${(err as Error).message}` }, { status: 500 })
  }
}

/** 保存动态 LLM 配置到数据库 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    baseUrl?: string
    apiKey?: string
    model?: string
    visionModel?: string
  } | null

  if (!body) {
    return NextResponse.json({ error: '缺少请求体' }, { status: 400 })
  }

  try {
    const supabase = getAdminClient()
    const entries: Array<{ key: string; value: string; description: string; updated_at: string }> = []
    const now = new Date().toISOString()

    if (typeof body.baseUrl === 'string') {
      entries.push({
        key: 'llm_base_url',
        value: body.baseUrl.trim().replace(/\/+$/, ''),
        description: 'OpenAI 兼容协议基础端点',
        updated_at: now,
      })
    }

    if (typeof body.apiKey === 'string' && body.apiKey.trim()) {
      entries.push({
        key: 'llm_api_key',
        value: body.apiKey.trim(),
        description: 'LLM API 密钥',
        updated_at: now,
      })
    }

    if (typeof body.model === 'string' && body.model.trim()) {
      entries.push({
        key: 'llm_model',
        value: body.model.trim(),
        description: '默认文本与菜谱抽取模型',
        updated_at: now,
      })
    }

    if (typeof body.visionModel === 'string' && body.visionModel.trim()) {
      entries.push({
        key: 'llm_vision_model',
        value: body.visionModel.trim(),
        description: 'OCR 菜谱图片视觉识别模型',
        updated_at: now,
      })
    }

    if (entries.length > 0) {
      const { error } = await supabase
        .from('system_settings')
        .upsert(entries, { onConflict: 'key' })

      if (error) throw new Error(error.message)
    }

    return NextResponse.json({ ok: true, message: 'LLM 系统设置已保存并即时生效！' })
  } catch (err) {
    console.error('保存设置异常：', err)
    return NextResponse.json({ error: `保存失败：${(err as Error).message}` }, { status: 500 })
  }
}
