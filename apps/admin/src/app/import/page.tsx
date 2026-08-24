'use client'

import Link from 'next/link'
import { useState } from 'react'

interface ImportResultItem {
  title: string
  ok: boolean
  message: string
}

interface ImportResponse {
  ok: boolean
  importedCount: number
  results: ImportResultItem[]
}

export default function ImportPage() {
  const [jsonText, setJsonText] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [pending, setPending] = useState(false)
  const [report, setReport] = useState<ImportResponse | null>(null)
  const [error, setError] = useState('')

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
      const body = (await response.json()) as ImportResponse & { message?: string }
      if (!response.ok) {
        setError(body.message ?? `导入失败（${response.status}）`)
        return
      }
      setReport(body)
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
      const body = (await response.json()) as ImportResponse & { message?: string }
      if (!response.ok) {
        setError(body.message ?? `导入失败（${response.status}）`)
        return
      }
      setReport(body)
    } catch (err) {
      setError(`网络错误：${(err as Error).message}`)
    } finally {
      setPending(false)
    }
  }

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-10">
      <header className="mb-8">
        <Link href="/" className="mb-2 inline-block text-sm text-neutral-500">
          ← 返回管理端
        </Link>
        <h1 className="text-xl font-bold">菜谱导入</h1>
        <p className="mt-1 text-sm text-neutral-500">
          JSON 粘贴（recipe.v1）或 Excel 上传，先校验再入库
        </p>
      </header>

      <section className="mb-6 rounded-xl border border-neutral-200 bg-white p-6">
        <h2 className="mb-3 font-semibold">JSON 导入</h2>
        <textarea
          value={jsonText}
          onChange={(event) => setJsonText(event.target.value)}
          placeholder='粘贴 recipe.v1 格式的 JSON（单条对象或数组）'
          className="min-h-40 w-full rounded-lg border border-neutral-300 p-3 font-mono text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
        />
        <button
          type="button"
          onClick={handleJsonImport}
          disabled={pending || jsonText.trim().length === 0}
          className="mt-3 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
        >
          {pending ? '导入中…' : '导入 JSON'}
        </button>
      </section>

      <section className="mb-6 rounded-xl border border-neutral-200 bg-white p-6">
        <h2 className="mb-3 font-semibold">Excel 批量导入</h2>
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
          {pending ? '导入中…' : '导入 Excel'}
        </button>
      </section>

      {error && (
        <p className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </p>
      )}

      {report && (
        <section className="rounded-xl border border-neutral-200 bg-white p-6">
          <h2 className="mb-3 font-semibold">
            导入报告（成功 {report.importedCount} 条）
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