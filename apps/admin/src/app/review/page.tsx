'use client'

import { useState, useEffect } from 'react'
import { CheckSquare, Check, X, Clock, AlertCircle, RotateCw } from 'lucide-react'

interface PendingRecipeItem {
  id: string
  title: string
  source_type: string
  difficulty: number
  minutes: number
  tags: string[]
  created_at: string
}

export default function ReviewCenterPage() {
  const [items, setItems] = useState<PendingRecipeItem[]>([])
  const [loading, setLoading] = useState(false)
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const fetchPendingRecipes = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/recipes/review')
      if (res.ok) {
        const body = await res.json()
        setItems(body.items || [])
      }
    } catch {
      // 忽略
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPendingRecipes()
  }, [])

  const handleAction = async (recipeId: string, action: 'publish' | 'reject') => {
    setProcessingId(recipeId)
    setMessage(null)
    try {
      const res = await fetch('/api/recipes/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipeId, action }),
      })
      const data = await res.json()
      if (res.ok) {
        setMessage(data.message)
        setItems((prev) => prev.filter((item) => item.id !== recipeId))
      } else {
        setMessage(data.error || '审核操作失败')
      }
    } catch (err) {
      setMessage((err as Error).message)
    } finally {
      setProcessingId(null)
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">审核中心</h1>
          <p className="text-sm text-neutral-500 mt-1">
            对多渠道（AI批量生成、URL抽取、OCR识别、Excel/JSON导入）暂存菜谱进行人工抽检与合规发布
          </p>
        </div>
        <button
          onClick={fetchPendingRecipes}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-neutral-200 hover:bg-neutral-50 rounded-lg text-xs font-medium text-neutral-700 shadow-xs transition"
        >
          <RotateCw className="w-3.5 h-3.5" />
          <span>刷新待审</span>
        </button>
      </div>

      {message && (
        <div className="p-3.5 rounded-lg bg-neutral-900 text-white text-xs font-medium flex items-center justify-between">
          <span>{message}</span>
          <button onClick={() => setMessage(null)} className="text-neutral-400 hover:text-white">
            关闭
          </button>
        </div>
      )}

      {/* 待审列表 */}
      <div className="bg-white rounded-xl border border-neutral-200/80 shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-neutral-100 flex items-center justify-between">
          <div className="font-semibold text-sm text-neutral-900 flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-600" />
            <span>待审菜谱工单列表 ({items.length})</span>
          </div>
        </div>

        <div className="divide-y divide-neutral-100">
          {loading && items.length === 0 ? (
            <div className="py-16 text-center text-xs text-neutral-400">正在检索待审工单...</div>
          ) : items.length === 0 ? (
            <div className="py-16 text-center space-y-2">
              <div className="text-sm font-semibold text-neutral-800">全部待审工单已清空 🎉</div>
              <p className="text-xs text-neutral-400">目前暂无排队中的待审菜谱，系统运行平稳</p>
            </div>
          ) : (
            items.map((recipe) => (
              <div
                key={recipe.id}
                className="p-4.5 hover:bg-neutral-50/60 transition flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2.5">
                    <span className="text-sm font-bold text-neutral-900">{recipe.title}</span>
                    <span className="px-2 py-0.5 rounded text-[11px] font-mono uppercase bg-neutral-100 text-neutral-700">
                      {recipe.source_type}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-neutral-500">
                    <span>难度: {'★'.repeat(recipe.difficulty)}</span>
                    <span>•</span>
                    <span>预计耗时: {recipe.minutes} 分钟</span>
                    <span>•</span>
                    <span>提交时间: {new Date(recipe.created_at).toLocaleString('zh-CN')}</span>
                  </div>
                  {recipe.tags && recipe.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {recipe.tags.map((tag) => (
                        <span
                          key={tag}
                          className="px-2 py-0.5 rounded-full text-[10px] bg-neutral-50 border border-neutral-200 text-neutral-600"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2.5 shrink-0">
                  <button
                    onClick={() => handleAction(recipe.id, 'reject')}
                    disabled={processingId === recipe.id}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-medium rounded-lg transition disabled:opacity-50"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>驳回废弃</span>
                  </button>
                  <button
                    onClick={() => handleAction(recipe.id, 'publish')}
                    disabled={processingId === recipe.id}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded-lg transition shadow-xs disabled:opacity-50"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>通过并发布</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
