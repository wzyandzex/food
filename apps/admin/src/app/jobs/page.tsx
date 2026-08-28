'use client'

import { useState, useEffect } from 'react'
import type { RecipeSourceType } from '@kaifan/shared'
import {
  FileCode,
  Globe,
  Sparkles,
  RotateCw,
  ChevronRight,
} from 'lucide-react'

type ImportTab = 'llm' | 'url' | 'ocr' | 'json' | 'excel'

export interface DbImportJob {
  id: string
  type: RecipeSourceType
  status: 'pending' | 'running' | 'succeeded' | 'partial_success' | 'failed' | 'canceled'
  total: number
  completed: number
  succeeded: number
  failed: number
  payload?: Record<string, unknown>
  created_by?: string | null
  started_at?: string | null
  completed_at?: string | null
  created_at: string
  updated_at: string
}

export interface DbImportJobItem {
  id: string
  job_id: string
  input?: Record<string, unknown>
  status: 'pending' | 'running' | 'succeeded' | 'failed' | 'canceled'
  attempt: number
  max_attempts: number
  result?: Record<string, unknown> | null
  error_code?: string | null
  error_message?: string | null
  recipe_id?: string | null
  created_at: string
}

interface JobDetailPayload {
  job: DbImportJob
  items: DbImportJobItem[]
}

export default function JobsPage() {
  const [activeTab, setActiveTab] = useState<ImportTab>('llm')

  // 表单状态
  const [llmDishNames, setLlmDishNames] = useState('')
  const [url, setUrl] = useState('')
  const [jsonText, setJsonText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // 任务列表状态（强类型化，消除 any）
  const [jobs, setJobs] = useState<DbImportJob[]>([])
  const [loadingJobs, setLoadingJobs] = useState(false)
  const [selectedJob, setSelectedJob] = useState<JobDetailPayload | null>(null)

  const fetchJobs = async () => {
    setLoadingJobs(true)
    try {
      const res = await fetch('/api/jobs?limit=15')
      if (res.ok) {
        const data = (await res.json()) as { jobs?: DbImportJob[] }
        setJobs(data.jobs || [])
      }
    } catch {
      // 忽略
    } finally {
      setLoadingJobs(false)
    }
  }

  useEffect(() => {
    fetchJobs()
    const interval = setInterval(fetchJobs, 8000)
    return () => clearInterval(interval)
  }, [])

  // 提交异步任务
  const handleSubmitJob = async () => {
    setSubmitting(true)
    setMessage(null)

    try {
      let items: Array<Record<string, unknown>> = []
      let type: RecipeSourceType = 'llm'

      if (activeTab === 'llm') {
        const names = llmDishNames
          .split('\n')
          .map((n) => n.trim())
          .filter(Boolean)
        if (names.length === 0) {
          setMessage({ type: 'error', text: '请至少输入一个菜名' })
          setSubmitting(false)
          return
        }
        items = names.map((name) => ({ title: name }))
        type = 'llm'
      } else if (activeTab === 'url') {
        if (!url.trim()) {
          setMessage({ type: 'error', text: '请输入目标菜谱 URL' })
          setSubmitting(false)
          return
        }
        items = [{ url: url.trim() }]
        type = 'url'
      } else if (activeTab === 'json') {
        const parsed = JSON.parse(jsonText)
        items = Array.isArray(parsed) ? parsed : [parsed]
        type = 'json'
      } else {
        setMessage({ type: 'error', text: '该类型暂请直接通过旧版导入上传' })
        setSubmitting(false)
        return
      }

      const res = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', type, items }),
      })

      const data = (await res.json()) as { ok?: boolean; jobId?: string; error?: string }
      if (res.ok && data.jobId) {
        setMessage({ type: 'success', text: `任务已创建排队 (ID: ${data.jobId.slice(0, 8)})` })
        setLlmDishNames('')
        setUrl('')
        setJsonText('')
        fetchJobs()
      } else {
        setMessage({ type: 'error', text: data.error || '创建任务失败' })
      }
    } catch (err) {
      setMessage({ type: 'error', text: (err as Error).message })
    } finally {
      setSubmitting(false)
    }
  }

  // 仅重试失败子项
  const handleRetryFailed = async (jobId: string) => {
    try {
      await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'retry_failed', jobId }),
      })
      fetchJobs()
    } catch (err) {
      console.error(err)
    }
  }

  // 查看任务详情
  const handleViewJobDetail = async (jobId: string) => {
    try {
      const res = await fetch(`/api/jobs?id=${jobId}`)
      if (res.ok) {
        const data = (await res.json()) as JobDetailPayload
        setSelectedJob(data)
      }
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">导入任务中心</h1>
        <p className="text-sm text-neutral-500 mt-1">
          将批量 LLM、URL、图片或文件解析转为后台异步任务，支持进度追踪、错误归因与断点重试
        </p>
      </div>

      {/* 导入操作区（选项卡切换） */}
      <div className="bg-white rounded-xl border border-neutral-200/80 shadow-xs overflow-hidden">
        <div className="flex border-b border-neutral-100 bg-neutral-50/50 px-4">
          <button
            onClick={() => setActiveTab('llm')}
            className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'llm'
                ? 'border-amber-600 text-amber-700 bg-white'
                : 'border-transparent text-neutral-500 hover:text-neutral-900'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI 批量生成</span>
          </button>
          <button
            onClick={() => setActiveTab('url')}
            className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'url'
                ? 'border-amber-600 text-amber-700 bg-white'
                : 'border-transparent text-neutral-500 hover:text-neutral-900'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>URL 抓取解析</span>
          </button>
          <button
            onClick={() => setActiveTab('json')}
            className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'json'
                ? 'border-amber-600 text-amber-700 bg-white'
                : 'border-transparent text-neutral-500 hover:text-neutral-900'
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            <span>JSON 批量导入</span>
          </button>
        </div>

        <div className="p-6">
          {activeTab === 'llm' && (
            <div className="space-y-4 max-w-2xl">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  菜名列表（每行一道菜）
                </label>
                <textarea
                  rows={4}
                  value={llmDishNames}
                  onChange={(e) => setLlmDishNames(e.target.value)}
                  placeholder="例如：&#10;西红柿炒鸡蛋&#10;鱼香肉丝&#10;回锅肉"
                  className="w-full text-xs font-mono p-3 border border-neutral-300 rounded-lg focus:outline-hidden focus:border-amber-600"
                />
              </div>
            </div>
          )}

          {activeTab === 'url' && (
            <div className="space-y-4 max-w-2xl">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  目标菜谱网页链接 (安全防 SSRF)
                </label>
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full text-xs p-2.5 border border-neutral-300 rounded-lg focus:outline-hidden focus:border-amber-600"
                />
              </div>
            </div>
          )}

          {activeTab === 'json' && (
            <div className="space-y-4 max-w-2xl">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  JSON 数组 (recipe.v1)
                </label>
                <textarea
                  rows={5}
                  value={jsonText}
                  onChange={(e) => setJsonText(e.target.value)}
                  placeholder="[{ title: '...' }]"
                  className="w-full text-xs font-mono p-3 border border-neutral-300 rounded-lg focus:outline-hidden focus:border-amber-600"
                />
              </div>
            </div>
          )}

          {message && (
            <div
              className={`mt-4 p-3 rounded-lg text-xs font-medium ${
                message.type === 'success' ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'
              }`}
            >
              {message.text}
            </div>
          )}

          <div className="mt-5">
            <button
              onClick={handleSubmitJob}
              disabled={submitting}
              className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-white rounded-lg text-xs font-medium transition disabled:opacity-50"
            >
              {submitting ? '提交创建中...' : '提交并排队异步任务'}
            </button>
          </div>
        </div>
      </div>

      {/* 任务列表展示 */}
      <div className="bg-white rounded-xl border border-neutral-200/80 shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-neutral-100 flex items-center justify-between">
          <div className="font-semibold text-sm text-neutral-900">异步任务排队流水</div>
          <button
            onClick={fetchJobs}
            className="text-xs text-neutral-500 hover:text-neutral-900 flex items-center gap-1"
          >
            <RotateCw className="w-3 h-3" />
            <span>刷新</span>
          </button>
        </div>

        <div className="divide-y divide-neutral-100">
          {loadingJobs && jobs.length === 0 ? (
            <div className="py-12 text-center text-xs text-neutral-400">加载任务列表中...</div>
          ) : jobs.length === 0 ? (
            <div className="py-12 text-center text-xs text-neutral-400">暂无任何异步任务</div>
          ) : (
            jobs.map((job) => {
              const progressPct = job.total > 0 ? Math.round((job.completed / job.total) * 100) : 0

              return (
                <div key={job.id} className="p-4 hover:bg-neutral-50/60 transition flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className="px-2 py-0.5 rounded text-[11px] font-mono uppercase bg-neutral-100 text-neutral-700">
                      {job.type}
                    </span>
                    <div>
                      <div className="text-xs font-semibold text-neutral-900 flex items-center gap-2">
                        <span>批次 {job.id.slice(0, 8)}</span>
                        <span className="text-[10px] text-neutral-400 font-normal">
                          {new Date(job.created_at).toLocaleString('zh-CN')}
                        </span>
                      </div>
                      {/* 进度条 */}
                      <div className="mt-2 w-48 bg-neutral-100 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-amber-600 h-1.5 rounded-full transition-all"
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right text-xs">
                      <div>
                        成功: <span className="font-semibold text-emerald-600">{job.succeeded}</span> / 总共: {job.total}
                      </div>
                      {job.failed > 0 && (
                        <div className="text-[11px] text-red-500">失败: {job.failed}</div>
                      )}
                    </div>

                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium ${
                        job.status === 'succeeded'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : job.status === 'partial_success'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : job.status === 'running'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200 animate-pulse'
                          : job.status === 'failed'
                          ? 'bg-red-50 text-red-700 border border-red-200'
                          : 'bg-neutral-100 text-neutral-600'
                      }`}
                    >
                      {job.status}
                    </span>

                    <div className="flex items-center gap-2">
                      {job.failed > 0 && (
                        <button
                          onClick={() => handleRetryFailed(job.id)}
                          className="px-2 py-1 text-[11px] font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 rounded border border-amber-200"
                        >
                          仅重试失败
                        </button>
                      )}
                      <button
                        onClick={() => handleViewJobDetail(job.id)}
                        className="p-1 text-neutral-400 hover:text-neutral-900 rounded"
                        title="查看明细"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* 弹窗：任务明细抽屉/弹窗 */}
      {selectedJob && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden">
            <div className="p-4 border-b border-neutral-100 flex items-center justify-between">
              <div className="font-semibold text-sm text-neutral-900">
                任务明细：批次 {selectedJob.job.id.slice(0, 8)}
              </div>
              <button
                onClick={() => setSelectedJob(null)}
                className="text-xs text-neutral-400 hover:text-neutral-800"
              >
                关闭
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1 divide-y divide-neutral-100">
              {selectedJob.items.map((item: DbImportJobItem) => (
                <div key={item.id} className="py-2.5 flex items-center justify-between text-xs">
                  <div>
                    <div className="font-medium text-neutral-800">
                      {String(item.input?.title || item.input?.url || '子任务项')}
                    </div>
                    {item.error_message && (
                      <div className="text-[11px] text-red-500 mt-0.5">
                        [{item.error_code || 'ERROR'}] {item.error_message}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] text-neutral-400">重试: {item.attempt} 次</span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                        item.status === 'succeeded'
                          ? 'bg-emerald-100 text-emerald-800'
                          : item.status === 'failed'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-neutral-100 text-neutral-700'
                      }`}
                    >
                      {item.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
