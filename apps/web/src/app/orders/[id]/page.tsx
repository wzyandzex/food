'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ORDER_SESSION_STATUS_LABELS, type OrderSessionStatus } from '@kaifan/shared'

import { useAuth } from '@/components/auth-provider'

interface OrderItemLike {
  recipeId?: string
  freeText?: string
  servings?: number
  note?: string
}

interface OrderDetailPayload {
  id: string
  title: string
  deadline: string
  status: string
  entries: Array<{ nickname: string; items: OrderItemLike[] }>
  ingredientsSummary: Array<{ name: string; qty: number; unit: string }>
  shareToken: string | null
}

export default function OrderSummaryPage() {
  const params = useParams<{ id: string }>()
  const { getAccessToken, loading: authLoading } = useAuth()
  const [data, setData] = useState<OrderDetailPayload | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  // 「家里已有」的食材名集合：勾掉后剩余即为缺失清单（PRD §4.4）
  const [haveIngredients, setHaveIngredients] = useState<Set<string>>(new Set())
  const [savingList, setSavingList] = useState(false)
  const [listSavedMsg, setListSavedMsg] = useState('')
  // 状态流转
  const [transitioning, setTransitioning] = useState(false)

  /** 发起人状态操作（PRD §4.5 状态机） */
  const STATUS_ACTIONS: Array<{ status: OrderSessionStatus; label: string; className: string }> = [
    { status: 'closed', label: '⏹ 截单', className: 'bg-neutral-900' },
    { status: 'cooking', label: '🍳 开始做饭', className: 'bg-brand' },
    { status: 'done', label: '✅ 这顿搞定', className: 'bg-green-600' },
    { status: 'canceled', label: '取消这顿饭', className: 'bg-red-500' },
  ]

  const availableActions =
    data
      ? ((
          {
            open: ['closed', 'canceled'],
            closed: ['cooking', 'canceled'],
            cooking: ['done'],
            done: [],
            canceled: [],
          } as Record<string, OrderSessionStatus[]>
        )[data.status] ?? [])
      : []

  const transitionTo = async (nextStatus: OrderSessionStatus) => {
    if (nextStatus === 'canceled' && !window.confirm('确定取消这场点单吗？已收到的点单会保留但不可再改。')) {
      return
    }
    setTransitioning(true)
    try {
      const token = await getAccessToken()
      if (!token) throw new Error('请先登录')
      const res = await fetch(`/api/orders/${params.id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: nextStatus }),
      })
      const body = (await res.json()) as { ok?: boolean; error?: string }
      if (!res.ok || !body.ok) throw new Error(body.error || '操作失败')
      setData((prev) => (prev ? { ...prev, status: nextStatus } : prev))
    } catch (err) {
      window.alert((err as Error).message)
    } finally {
      setTransitioning(false)
    }
  }

  const missingIngredients =
    data?.ingredientsSummary.filter((ing) => !haveIngredients.has(ing.name)) ?? []

  const toggleHaveIngredient = (name: string) => {
    setHaveIngredients((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  const saveMissingToList = async () => {
    setSavingList(true)
    setListSavedMsg('')
    try {
      const token = await getAccessToken()
      if (!token) throw new Error('请先登录')
      const res = await fetch('/api/shopping-lists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          items: missingIngredients.map((ing) => ({ name: ing.name, qty: ing.qty, unit: ing.unit })),
        }),
      })
      const body = (await res.json()) as { ok?: boolean; count?: number; error?: string }
      if (!res.ok || !body.ok) throw new Error(body.error || '保存失败')
      setListSavedMsg(`已把 ${body.count} 项缺失食材存入购物清单 ✓`)
    } catch (err) {
      setListSavedMsg((err as Error).message)
    } finally {
      setSavingList(false)
    }
  }

  useEffect(() => {
    if (authLoading) return
    if (!data && !error) {
      void (async () => {
        const token = await getAccessToken()
        if (!token) {
          setError('请先登录后查看点单汇总')
          setLoading(false)
          return
        }
        try {
          const res = await fetch(`/api/orders/${params.id}`, {
            headers: { Authorization: `Bearer ${token}` },
          })
          const body = (await res.json()) as OrderDetailPayload & { error?: string }
          if (!res.ok) {
            setError(body.error ?? `加载失败（${res.status}）`)
          } else {
            setData(body)
          }
        } catch (err) {
          console.error('点单详情加载失败：', err)
          setError('网络错误，请稍后重试')
        } finally {
          setLoading(false)
        }
      })()
    }
  }, [authLoading, data, error, getAccessToken, params.id])

  return (
    <main className="mx-auto min-h-dvh w-full max-w-md px-5 pt-10 pb-16">
      <header className="mb-6">
        <Link href="/orders" className="mb-2 inline-block text-xs text-ink/50">
          ← 返回点单列表
        </Link>
        {loading || authLoading ? (
          <p className="text-sm text-ink/50">加载中…</p>
        ) : error ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-800">
            {error}
          </div>
        ) : data ? (
          <>
            <h1 className="text-xl font-bold">{data.title}</h1>
            <p className="text-xs text-ink/60">点单汇总与食材采购清单</p>
          </>
        ) : null}
      </header>

      {/* 发起人状态操作区（PRD §4.5 状态机） */}
      {!loading && !authLoading && !error && data && availableActions.length > 0 && (
        <section className="mb-6 rounded-2xl bg-white p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-ink">当前状态</h2>
            <span className="rounded-full bg-brand-soft px-2 py-0.5 text-xs font-medium text-brand-deep">
              {ORDER_SESSION_STATUS_LABELS[data.status as OrderSessionStatus] ?? data.status}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {STATUS_ACTIONS.filter((action) => availableActions.includes(action.status)).map(
              (action) => (
                <button
                  key={action.status}
                  type="button"
                  disabled={transitioning}
                  onClick={() => void transitionTo(action.status)}
                  className={`rounded-lg ${action.className} px-3 py-2 text-xs font-semibold text-white shadow-sm disabled:opacity-40`}
                >
                  {transitioning ? '处理中…' : action.label}
                </button>
              ),
            )}
          </div>
        </section>
      )}

      {!loading && !authLoading && !error && data && (
        <>
          {/* 分享链接（仅发起人可见） */}
          {data.shareToken && (
            <section className="mb-6 rounded-2xl bg-white p-5 shadow-sm space-y-2">
              <h2 className="text-sm font-bold text-ink">📤 分享点单链接</h2>
              <p className="text-xs text-ink/50 break-all">
                {typeof window !== 'undefined'
                  ? `${window.location.origin}/o/${data.shareToken}`
                  : `/o/${data.shareToken}`}
              </p>
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard?.writeText(`${window.location.origin}/o/${data.shareToken}`)
                }}
                className="rounded-lg bg-neutral-100 px-3 py-1.5 text-xs font-medium text-ink/70"
              >
                复制链接
              </button>
              <Link
                href={`/o/${data.shareToken}`}
                className="ml-2 text-xs text-brand underline"
              >
                预览点单页 ↗
              </Link>
            </section>
          )}

          {/* 谁点了什么 */}
          <section className="mb-6 rounded-2xl bg-white p-5 shadow-sm space-y-3">
            <h2 className="text-sm font-bold text-ink">点单明细（{data.entries.length} 人）</h2>
            {data.entries.length === 0 ? (
              <p className="text-xs text-ink/40">暂无人点单</p>
            ) : (
              <div className="space-y-3">
                {data.entries.map((entry, idx) => (
                  <div key={idx} className="border-b border-neutral-100 pb-2.5 last:border-0 last:pb-0">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-ink">{entry.nickname}</span>
                    </div>
                    <div className="text-xs text-ink/70 mt-1 pl-2 space-y-0.5">
                      {entry.items.map((it, itIdx) => (
                        <div key={itIdx}>
                          🍽️ {it.freeText || it.recipeId}
                          {(it.servings ?? 1) > 1 && (
                            <span className="font-semibold text-brand-deep"> ×{it.servings}</span>
                          )}{' '}
                          {it.note && <span className="text-brand-deep">（{it.note}）</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* 食材采购 / 缺失食材清单 */}
          <section className="rounded-2xl bg-white p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-ink">🛒 采购清单 / 缺失食材</h2>
              <span className="text-xs text-ink/40">按份数倍乘 · 同名合并</span>
            </div>

            {data.ingredientsSummary.length === 0 ? (
              <p className="text-xs text-ink/40 leading-5">
                点单菜品暂无可提取的标准食材表（自由报菜名需手动采购）
              </p>
            ) : (
              <>
                <ul className="space-y-2 text-xs">
                  {data.ingredientsSummary.map((ing) => {
                    const haveIt = haveIngredients.has(ing.name)
                    return (
                      <li
                        key={ing.name}
                        onClick={() => toggleHaveIngredient(ing.name)}
                        className={`flex cursor-pointer select-none items-center justify-between rounded-lg p-2.5 transition-colors ${
                          haveIt ? 'bg-green-50/70' : 'bg-neutral-50'
                        }`}
                      >
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={haveIt}
                            onChange={() => {}}
                            className="size-3.5 rounded accent-green-600"
                            aria-label={`标记家里已有 ${ing.name}`}
                          />
                          <span className={`font-medium text-ink ${haveIt ? 'line-through opacity-60' : ''}`}>
                            {ing.name}
                          </span>
                        </label>
                        <span className="text-brand-deep font-semibold">
                          {ing.qty > 0 ? `${ing.qty} ${ing.unit}` : '适量'}
                        </span>
                      </li>
                    )
                  })}
                </ul>

                <div className="border-t border-neutral-100 pt-3 space-y-2">
                  <p className="text-xs text-ink/60">
                    勾掉「家里已有」后，缺失食材共{' '}
                    <span className="font-semibold text-brand-deep">{missingIngredients.length}</span> 项
                  </p>
                  <button
                    type="button"
                    onClick={() => void saveMissingToList()}
                    disabled={savingList || missingIngredients.length === 0}
                    className="w-full rounded-xl bg-brand py-2.5 text-xs font-semibold text-white shadow-sm disabled:opacity-40"
                  >
                    {savingList ? '保存中…' : '🛒 一键存为购物清单'}
                  </button>
                  {listSavedMsg && (
                    <p className="text-xs text-green-700">{listSavedMsg}</p>
                  )}
                </div>
              </>
            )}
          </section>
        </>
      )}
    </main>
  )
}
