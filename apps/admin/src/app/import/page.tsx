'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

interface ImportResultItem {
  title: string
  ok: boolean
  message: string
  recipeId?: string
}

interface ImportResponse {
  ok: boolean
  stagedCount: number
  results: ImportResultItem[]
}

interface PendingItem {
  id: string
  title: string
  source_type: string
  difficulty: number
  minutes: number
  tags: string[]
  created_at: string
}

export default function ImportPage() {
  const [jsonText, setJsonText] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [llmDishNames, setLlmDishNames] = useState('')
  const [pending, setPending] = useState(false)
  const [report, setReport] = useState<ImportResponse | null>(null)
  const [error, setError] = useState('')

  // URL 导入状态
  const [importUrl, setImportUrl] = useState('')
  const [urlPending, setUrlPending] = useState(false)
  const [urlResult, setUrlResult] = useState<string | null>(null)

  // OCR 图片导入状态
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [ocrPending, setOcrPending] = useState(false)
  const [ocrResult, setOcrResult] = useState<string | null>(null)

  // 待确认队列状态（PRD §4.2 两段式第二段）
  const [pendingList, setPendingList] = useState<PendingItem[]>([])
  const [loadingPending, setLoadingPending] = useState(false)
  const [reviewingId, setReviewingId] = useState<string | null>(null)

  const fetchPending = async () => {
    setLoadingPending(true)
    try {
      const res = await fetch('/api/recipes/review')
      if (res.ok) {
        const body = (await res.json()) as { items?: PendingItem[] }
        setPendingList(body.items ?? [])
      }
    } catch {
      // 忽略
    } finally {
      setLoadingPending(false)
    }
  }

  useEffect(() => {
    void fetchPending()
  }, [])

  const handleJsonImport = async () => {
    setPending(true)
    setError('')
    setReport(null)
    try {
      let payload: unknown
      try {
        payload = JSON.parse(jsonText)
      } catch {
        setError('JSON 格式错误，请检查')
        return
      }

      const response = await fetch('/api/recipes/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const body = (await response.json()) as ImportResponse & { message?: string; error?: string }
      if (!response.ok) {
        setError(body.error ?? body.message ?? `导入失败（${response.status}）`)
        return
      }
      setReport(body)
      void fetchPending()
    } catch (err) {
      setError(`网络错误：${(err as Error).message}`)
    } finally {
      setPending(false)
    }
  }

  const handleExcelImport = async () => {
    if (!file) return
    setPending(true)
    setError('')
    setReport(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const response = await fetch('/api/recipes/import-excel', {
        method: 'POST',
        body: formData,
      })
      const body = (await response.json()) as ImportResponse & { message?: string; error?: string }
      if (!response.ok) {
        setError(body.error ?? body.message ?? `导入失败（${response.status}）`)
        return
      }
      setReport(body)
      void fetchPending()
    } catch (err) {
      setError(`网络错误：${(err as Error).message}`)
    } finally {
      setPending(false)
    }
  }

  const handleLlmGenerate = async () => {
    const dishNames = llmDishNames
      .split(/[,，\n]/)
      .map((s) => s.trim())
      .filter(Boolean)

    if (dishNames.length === 0) return

    setPending(true)
    setError('')
    setReport(null)
    try {
      const response = await fetch('/api/recipes/generate-llm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dishNames }),
      })
      const body = (await response.json()) as ImportResponse & { error?: string }
      if (!response.ok) {
        setError(body.error ?? `LLM 生成失败（${response.status}）`)
        return
      }
      setReport(body)
      void fetchPending()
    } catch (err) {
      setError(`网络错误：${(err as Error).message}`)
    } finally {
      setPending(false)
    }
  }

  const handleUrlImport = async () => {
    const url = importUrl.trim()
    if (!url) return

    setUrlPending(true)
    setUrlResult(null)
    try {
      const response = await fetch('/api/recipes/import-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      const body = (await response.json()) as {
        ok?: boolean
        message?: string
        summary?: { title: string; ingredientCount: number; stepCount: number; minutes: number }
        error?: string
      }
      if (!response.ok || !body.ok) {
        setUrlResult(`✗ ${body.error ?? `导入失败（${response.status}）`}`)
        return
      }
      setUrlResult(
        `✓ ${body.message}——「${body.summary?.title}」${body.summary?.ingredientCount} 种食材 / ${body.summary?.stepCount} 步 / 约 ${body.summary?.minutes} 分钟`,
      )
      setImportUrl('')
      void fetchPending()
    } catch (err) {
      setUrlResult(`✗ 网络错误：${(err as Error).message}`)
    } finally {
      setUrlPending(false)
    }
  }

  const handleOcrImport = async () => {
    if (!imageFile) return

    setOcrPending(true)
    setOcrResult(null)
    try {
      const formData = new FormData()
      formData.append('image', imageFile)
      const response = await fetch('/api/recipes/import-image', {
        method: 'POST',
        body: formData,
      })
      const body = (await response.json()) as {
        ok?: boolean
        message?: string
        summary?: { title: string; ingredientCount: number; stepCount: number; minutes: number }
        error?: string
      }
      if (!response.ok || !body.ok) {
        setOcrResult(`✗ ${body.error ?? `导入失败（${response.status}）`}`)
        return
      }
      setOcrResult(
        `✓ ${body.message}——「${body.summary?.title}」${body.summary?.ingredientCount} 种食材 / ${body.summary?.stepCount} 步 / 约 ${body.summary?.minutes} 分钟`,
      )
      setImageFile(null)
      void fetchPending()
    } catch (err) {
      setOcrResult(`✗ 网络错误：${(err as Error).message}`)
    } finally {
      setOcrPending(false)
    }
  }

  const handleReview = async (recipeId: string, action: 'publish' | 'reject') => {
    setReviewingId(recipeId)
    try {
      const res = await fetch('/api/recipes/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipeId, action }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null
        alert(body?.error ?? '操作失败')
        return
      }
      setPendingList((prev) => prev.filter((item) => item.id !== recipeId))
    } catch (err) {
      alert(`网络错误：${(err as Error).message}`)
    } finally {
      setReviewingId(null)
    }
  }

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-10">
      <header className="mb-8">
        <Link href="/" className="mb-2 inline-block text-sm text-neutral-500">
          ← 返回管理端
        </Link>
        <h1 className="text-xl font-bold">菜谱导入（两段式：暂存 → 审核发布）</h1>
        <p className="mt-1 text-sm text-neutral-500">
          JSON 粘贴（recipe.v1）或 Excel 上传，通过校验后先进入待确认队列，人工审核后上架公共库（PRD §4.2）
        </p>
      </header>

      {/* 待确认审核队列 */}
      <section className="mb-8 rounded-xl border border-amber-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-neutral-900">待确认入库队列</h2>
            <p className="text-xs text-neutral-500">
              已暂存但未公开发布的菜谱（共 {pendingList.length} 条）
            </p>
          </div>
          <button
            type="button"
            onClick={fetchPending}
            disabled={loadingPending}
            className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs text-neutral-600 hover:bg-neutral-50"
          >
            {loadingPending ? '刷新中…' : '↻ 刷新'}
          </button>
        </div>

        {pendingList.length === 0 ? (
          <p className="py-6 text-center text-sm text-neutral-400">
            暂无待确认菜谱，可从下方上传暂存
          </p>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {pendingList.map((item) => (
              <li key={item.id} className="flex items-center justify-between py-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-neutral-900">{item.title}</span>
                    <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs text-neutral-500">
                      {item.source_type}
                    </span>
                    <span className="text-xs text-neutral-400">
                      {'⭐'.repeat(item.difficulty)} · ⏱ {item.minutes}m
                    </span>
                  </div>
                  {item.tags?.length > 0 && (
                    <p className="mt-0.5 text-xs text-neutral-400">
                      {item.tags.join(' / ')}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={reviewingId === item.id}
                    onClick={() => handleReview(item.id, 'publish')}
                    className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-40"
                  >
                    {reviewingId === item.id ? '处理中…' : '✓ 确认上架'}
                  </button>
                  <button
                    type="button"
                    disabled={reviewingId === item.id}
                    onClick={() => handleReview(item.id, 'reject')}
                    className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-40"
                  >
                    ✗ 驳回清除
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 第一段：JSON 上传 */}
      <section className="mb-6 rounded-xl border border-neutral-200 bg-white p-6">
        <h2 className="mb-3 font-semibold">1. JSON 导入（暂存入库）</h2>
        <textarea
          value={jsonText}
          onChange={(event) => setJsonText(event.target.value)}
          placeholder='粘贴 recipe.v1 格式的 JSON（单条对象或数组）'
          className="min-h-36 w-full rounded-lg border border-neutral-300 p-3 font-mono text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
        />
        <button
          type="button"
          onClick={handleJsonImport}
          disabled={pending || jsonText.trim().length === 0}
          className="mt-3 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
        >
          {pending ? '校验暂存中…' : '校验并暂存 JSON'}
        </button>
      </section>

      {/* 第一段：Excel 上传 */}
      <section className="mb-6 rounded-xl border border-neutral-200 bg-white p-6">
        <h2 className="mb-3 font-semibold">2. Excel 批量导入（暂存入库）</h2>
        <p className="mb-3 text-sm text-neutral-500">
          表头：菜名 | 份量 | 难度(1-5) | 分钟 | 标签(逗号分隔) | 食材(分号分隔) | 步骤(分号分隔)
        </p>
        <input
          type="file"
          accept=".xlsx,.xls"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          className="mb-3 block w-full text-sm"
        />
        <button
          type="button"
          onClick={handleExcelImport}
          disabled={pending || !file}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
        >
          {pending ? '校验暂存中…' : '校验并暂存 Excel'}
        </button>
      </section>

      {/* 第一段：LLM 调研批量生成（PRD §8 M1 承诺管线） */}
      <section className="mb-6 rounded-xl border border-neutral-200 bg-white p-6">
        <h2 className="mb-3 font-semibold">3. LLM 调研批量生成（暂存入库）</h2>
        <p className="mb-3 text-sm text-neutral-500">
          输入菜名清单（逗号或换行分隔），批量自动生成标准化 recipe.v1 数据并存入待确认队列
        </p>
        <textarea
          value={llmDishNames}
          onChange={(event) => setLlmDishNames(event.target.value)}
          placeholder="如：宫保鸡丁, 麻婆豆腐, 鱼香肉丝"
          className="min-h-24 w-full rounded-lg border border-neutral-300 p-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
        />
        <button
          type="button"
          onClick={handleLlmGenerate}
          disabled={pending || llmDishNames.trim().length === 0}
          className="mt-3 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
        >
          {pending ? '生成暂存中…' : '生成并暂存到队列'}
        </button>
      </section>

      {/* 第一段：URL 单篇导入 */}
      <section className="mb-6 rounded-xl border border-neutral-200 bg-white p-6">
        <h2 className="mb-1 font-semibold">4. URL 单篇导入（抓取 + AI 抽取，暂存入库）</h2>
        <p className="mb-3 text-sm text-neutral-500">
          粘贴任意菜谱网页链接（下厨房、豆果、美食博客等），服务端抓取正文后由大模型抽取为标准菜谱，自动署名原文链接
        </p>
        <div className="flex gap-2">
          <input
            type="url"
            value={importUrl}
            onChange={(event) => setImportUrl(event.target.value)}
            placeholder="https://www.xiachufang.com/recipe/..."
            className="min-w-0 flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
          />
          <button
            type="button"
            onClick={handleUrlImport}
            disabled={urlPending || importUrl.trim().length === 0}
            className="shrink-0 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
          >
            {urlPending ? 'AI 抽取中（约半分钟）…' : '抓取并抽取'}
          </button>
        </div>
        {urlResult && (
          <p
            className={`mt-3 rounded-lg p-3 text-sm ${
              urlResult.startsWith('✓') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
            }`}
          >
            {urlResult}
          </p>
        )}
      </section>

      {/* 第一段：OCR 图片导入 */}
      <section className="mb-6 rounded-xl border border-neutral-200 bg-white p-6">
        <h2 className="mb-1 font-semibold">5. 图片 OCR 导入（视觉模型识别，暂存入库）</h2>
        <p className="mb-3 text-sm text-neutral-500">
          上传菜谱照片（书本、手写笔记、聊天截图），AI 识别文字并转为标准菜谱。支持 JPG / PNG / WebP，≤5MB
        </p>
        <input
          type="file"
          accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
          onChange={(event) => setImageFile(event.target.files?.[0] ?? null)}
          className="mb-3 block w-full text-sm"
        />
        <button
          type="button"
          onClick={handleOcrImport}
          disabled={ocrPending || !imageFile}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
        >
          {ocrPending ? 'AI 识别中（约半分钟）…' : '识别并暂存到队列'}
        </button>
        {ocrResult && (
          <p
            className={`mt-3 rounded-lg p-3 text-sm ${
              ocrResult.startsWith('✓') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
            }`}
          >
            {ocrResult}
          </p>
        )}
      </section>

      {error && (
        <p className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </p>
      )}

      {report && (
        <section className="rounded-xl border border-neutral-200 bg-white p-6">
          <h2 className="mb-3 font-semibold">
            校验与暂存报告（成功暂存 {report.stagedCount} 条，请在上方确认上架）
          </h2>
          <ul className="space-y-2 text-sm">
            {report.results.map((item, index) => (
              <li key={`${item.title}-${index}`} className="flex gap-2">
                <span className={item.ok ? 'text-green-600' : 'text-red-600'}>
                  {item.ok ? '✓' : '✗'}
                </span>
                <span>
                  <span className="font-medium">{item.title}</span>
                  <span className="ml-1 text-neutral-500">{item.message}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  )
}
