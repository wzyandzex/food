'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

interface LlmConfigPayload {
  baseUrl: string
  model: string
  visionModel: string
  hasKey: boolean
  maskedKey: string
  source: 'db' | 'env' | 'none'
}

export default function SettingsPage() {
  const [baseUrl, setBaseUrl] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState('')
  const [visionModel, setVisionModel] = useState('')
  const [activeConfig, setActiveConfig] = useState<LlmConfigPayload | null>(null)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')

  const loadConfig = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/settings/llm')
      const body = (await res.json()) as { config?: LlmConfigPayload; error?: string }
      if (!res.ok || !body.config) throw new Error(body.error || '加载配置失败')

      setActiveConfig(body.config)
      setBaseUrl(body.config.baseUrl)
      setModel(body.config.model)
      setVisionModel(body.config.visionModel)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadConfig()
  }, [])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setMsg('')
    setError('')

    try {
      const res = await fetch('/api/settings/llm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseUrl,
          apiKey: apiKey.trim() || undefined,
          model,
          visionModel,
        }),
      })
      const body = (await res.json()) as { ok?: boolean; message?: string; error?: string }
      if (!res.ok || !body.ok) throw new Error(body.error || '保存失败')

      setMsg(body.message || '配置已保存并即时生效！')
      setApiKey('')
      void loadConfig()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async () => {
    setTesting(true)
    setMsg('')
    setError('')
    try {
      const res = await fetch('/api/settings/llm/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseUrl,
          apiKey: apiKey.trim() || undefined,
          model,
        }),
      })
      const body = (await res.json()) as { ok?: boolean; message?: string; error?: string }
      if (!res.ok || !body.ok) throw new Error(body.error || '连通测试失败')

      setMsg(body.message || '测试成功！')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setTesting(false)
    }
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-10">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <Link href="/" className="mb-1 inline-block text-xs text-neutral-500">
            ← 返回管理端首页
          </Link>
          <h1 className="text-xl font-bold">⚙️ 系统设置（LLM 动态配置）</h1>
          <p className="mt-1 text-sm text-neutral-500">
            管理端实时修改 AI 端点与密钥，保存后即时生效，无需重新 Deploy Vercel。
          </p>
        </div>
      </header>

      {loading ? (
        <p className="text-sm text-neutral-400">加载当前系统配置中…</p>
      ) : (
        <form onSubmit={handleSave} className="space-y-6">
          {/* 当前状态卡片 */}
          <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-neutral-700">当前运行配置来源：</span>
              <span
                className={`rounded-full px-2.5 py-0.5 font-semibold text-[11px] ${
                  activeConfig?.source === 'db'
                    ? 'bg-green-100 text-green-800'
                    : activeConfig?.source === 'env'
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-amber-100 text-amber-800'
                }`}
              >
                {activeConfig?.source === 'db'
                  ? '✓ 数据库动态配置 (热重载已生效)'
                  : activeConfig?.source === 'env'
                    ? '环境变量配置 (Vercel ENV)'
                    : '未配置 (当前使用本地模板)'}
              </span>
            </div>
            {activeConfig?.hasKey && (
              <p className="text-xs text-neutral-500">
                当前活跃密钥：<span className="font-mono">{activeConfig.maskedKey}</span>
              </p>
            )}
          </section>

          {/* 表单配置 */}
          <section className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm space-y-4">
            <h2 className="text-sm font-bold text-neutral-800">OpenAI 兼容端点参数</h2>

            <div>
              <label className="mb-1 block text-xs font-semibold text-neutral-700">
                API Base URL（请求基础端点）
              </label>
              <input
                type="url"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://vsllm.com/v1 或 https://open.bigmodel.cn/api/paas/v4"
                className="w-full rounded-lg border border-neutral-300 px-3.5 py-2 text-sm font-mono outline-none focus:border-brand"
                required
              />
              <p className="mt-1 text-[11px] text-neutral-400">
                无需加末尾的 /chat/completions。支持自建中转、OneAPI、第三方聚合平台。
              </p>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-neutral-700">
                API Key（留空则保持当前已保存的密钥不变）
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={activeConfig?.hasKey ? '••••••••••••••••（输入新密钥以覆盖）' : 'sk-xxxxxxxxxxxxxxxx'}
                className="w-full rounded-lg border border-neutral-300 px-3.5 py-2 text-sm font-mono outline-none focus:border-brand"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold text-neutral-700">
                  文本抽取与菜谱生成模型
                </label>
                <input
                  type="text"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder="如：gemini-3.7-flash-api、glm-4-flash、gpt-4o-mini"
                  className="w-full rounded-lg border border-neutral-300 px-3.5 py-2 text-sm font-mono outline-none focus:border-brand"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-neutral-700">
                  视觉/OCR 菜谱识别模型
                </label>
                <input
                  type="text"
                  value={visionModel}
                  onChange={(e) => setVisionModel(e.target.value)}
                  placeholder="如：gemini-3.7-flash-api、glm-4v-flash"
                  className="w-full rounded-lg border border-neutral-300 px-3.5 py-2 text-sm font-mono outline-none focus:border-brand"
                  required
                />
              </div>
            </div>
          </section>

          {msg && (
            <p className="rounded-xl border border-green-200 bg-green-50 p-3 text-xs leading-5 text-green-800">
              {msg}
            </p>
          )}

          {error && (
            <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs leading-5 text-red-700">
              {error}
            </p>
          )}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-xl bg-brand py-3 text-xs font-semibold text-white shadow-sm disabled:opacity-50 active:scale-95"
            >
              {saving ? '正在保存…' : '💾 保存动态配置（即时生效）'}
            </button>
            <button
              type="button"
              onClick={() => void handleTest()}
              disabled={testing || (!apiKey && !activeConfig?.hasKey)}
              className="rounded-xl border border-neutral-300 bg-white px-5 py-3 text-xs font-semibold text-neutral-700 shadow-sm hover:bg-neutral-50 disabled:opacity-40 active:scale-95"
            >
              {testing ? '测试连通中…' : '⚡ 在线测试连通性'}
            </button>
          </div>
        </form>
      )}
    </main>
  )
}
