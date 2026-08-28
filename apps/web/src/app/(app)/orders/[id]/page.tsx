'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ORDER_SESSION_STATUS_LABELS, type OrderSessionStatus } from '@kaifan/shared'

import { useAuth } from '@/components/auth-provider'
import { IconCheck } from '@/components/icons'
import { NavBar } from '@/components/ui'

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
  circleId: string | null
  circleName: string | null
  isHost: boolean
  entries: Array<{ nickname: string; items: OrderItemLike[] }>
  ingredientsSummary: Array<{ name: string; qty: number; unit: string }>
  recipeTitles: Record<string, string>
  shareToken: string | null
}

export default function OrderSummaryPage() {
  const params = useParams<{ id: string }>()
  const { getAccessToken, loading: authLoading } = useAuth()
  const [data, setData] = useState<OrderDetailPayload | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [haveIngredients, setHaveIngredients] = useState<Set<string>>(new Set())
  const [savingList, setSavingList] = useState(false)
  const [listSavedMsg, setListSavedMsg] = useState('')
  const [transitioning, setTransitioning] = useState(false)

  const STATUS_ACTIONS: Array<{ status: OrderSessionStatus; label: string; className: string }> = [
    { status: 'closed', label: '⏹ 截单', className: 'bg-fill text-ink' },
    { status: 'open', label: '重新开放', className: 'bg-fill text-ink' },
    { status: 'shopping', label: '🛒 开始采购', className: 'bg-tint-soft text-tint-deep' },
    { status: 'cooking', label: '🍳 开始做饭', className: 'bg-tint text-white' },
    { status: 'done', label: '✅ 这顿搞定', className: 'bg-success text-white' },
    { status: 'canceled', label: '取消这顿饭', className: 'bg-danger-soft text-danger' },
  ]

  const availableActions =
    data
      ? ((
          {
            open: ['closed', 'canceled'],
            closed: ['shopping', 'cooking', 'canceled', 'open'],
            shopping: ['cooking', 'done', 'canceled'],
            cooking: ['done', 'canceled'],
            done: [],
            canceled: [],
          } as Record<string, OrderSessionStatus[]>
        )[data.status] ?? [])
      : []

  const transitionTo = async (nextStatus: OrderSessionStatus) => {
    if (nextStatus === 'canceled' && !window.confirm('确定取消这场点单吗？')) return
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
      setListSavedMsg(`已把 ${body.count} 项缺失食材存入清单 ✓`)
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
          setError('网络错误，请稍后重试')
        } finally {
          setLoading(false)
        }
      })()
    }
  }, [authLoading, data, error, getAccessToken, params.id])

  if (loading || authLoading) {
    return <main className="screen text-center text-xs text-ink-3 pt-20">加载中…</main>
  }

  return (
    <div className="screen">
      <NavBar title="点单详情" back="/orders" backLabel="点单" />

      {error ? (
        <div className="card mt-6 p-4 text-center text-xs text-danger bg-danger-soft">{error}</div>
      ) : data ? (
        <div className="mt-4 space-y-4">
          {/* 头部信息 */}
          <section className="card p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h1 className="text-[17px] font-bold text-ink">{data.title}</h1>
              <span className="rounded-md bg-tint-soft px-2 py-0.5 text-[11px] font-medium text-tint-deep">
                {ORDER_SESSION_STATUS_LABELS[data.status as OrderSessionStatus] ?? data.status}
              </span>
            </div>
            <p className="text-[12px] text-ink-3">
              截止 {new Date(data.deadline).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </p>

            {/* 状态操作，仅发起人可用 */}
            {data.isHost && availableActions.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-2 border-t border-line">
                {STATUS_ACTIONS.filter((action) => availableActions.includes(action.status)).map(
                  (action) => (
                    <button
                      key={action.status}
                      type="button"
                      disabled={transitioning}
                      onClick={() => void transitionTo(action.status)}
                      className={`rounded-lg px-3 py-1.5 text-[12px] font-semibold transition active:scale-95 disabled:opacity-40 ${action.className}`}
                    >
                      {transitioning ? '处理中…' : action.label}
                    </button>
                  ),
                )}
              </div>
            )}
          </section>

          {/* 分享链接 */}
          {data.isHost && data.shareToken && (
            <section className="card p-4 space-y-2">
              <h2 className="text-[13px] font-medium text-ink-3">分享给好友</h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard?.writeText(`${window.location.origin}/o/${data.shareToken}`)
                    alert('已复制链接')
                  }}
                  className="rounded-lg bg-fill px-3 py-1.5 text-[12px] font-medium text-ink-2 active:bg-fill-strong"
                >
                  复制链接
                </button>
                <Link
                  href={`/o/${data.shareToken}`}
                  className="text-[12px] text-tint underline"
                >
                  预览点单页 ↗
                </Link>
              </div>
            </section>
          )}

          {/* 点单明细 */}
          <section className="card p-4 space-y-3">
            <h2 className="text-[13px] font-medium text-ink-3">谁点了什么（{data.entries.length} 人）</h2>
            {data.entries.length === 0 ? (
              <p className="text-[13px] text-ink-3">暂无人点单</p>
            ) : (
              <div className="divide-y divide-line">
                {data.entries.map((entry, idx) => (
                  <div key={idx} className="py-2.5 first:pt-0 last:pb-0">
                    <p className="text-[14px] font-semibold text-ink">{entry.nickname}</p>
                    <div className="mt-1 space-y-0.5 text-[13px] text-ink-2 pl-2">
                      {entry.items.map((it, itIdx) => (
                        <p key={itIdx}>
                          🍽️ {it.freeText || data.recipeTitles[it.recipeId ?? ''] || '（已下架菜谱）'}
                          {(it.servings ?? 1) > 1 && (
                            <span className="font-semibold text-tint-deep"> ×{it.servings}</span>
                          )}
                          {it.note && <span className="text-tint-deep">（{it.note}）</span>}
                        </p>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* 采购清单，仅发起人可用 */}
          {data.isHost && (
            <section className="card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-[13px] font-medium text-ink-3">采购 / 缺失食材</h2>
              <span className="text-[11px] text-ink-3">按份数合并</span>
            </div>

            {data.ingredientsSummary.length === 0 ? (
              <p className="text-[12px] text-ink-3 leading-5">
                暂无可提取的标准食材表（自由报菜名需手动采购）
              </p>
            ) : (
              <>
                <div className="space-y-1.5">
                  {data.ingredientsSummary.map((ing) => {
                    const haveIt = haveIngredients.has(ing.name)
                    return (
                      <div
                        key={ing.name}
                        onClick={() => toggleHaveIngredient(ing.name)}
                        className={`flex cursor-pointer select-none items-center justify-between rounded-lg p-2 text-[13px] transition ${
                          haveIt ? 'bg-fill/50 text-ink-3' : 'bg-fill text-ink'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className={`flex size-4 items-center justify-center rounded border ${
                              haveIt ? 'border-success bg-success text-white' : 'border-ink-3/40 bg-surface'
                            }`}
                          >
                            {haveIt && <IconCheck className="size-2.5" />}
                          </div>
                          <span className={haveIt ? 'line-through' : 'font-medium'}>{ing.name}</span>
                        </div>
                        <span className="font-semibold text-tint-deep">
                          {ing.qty > 0 ? `${ing.qty} ${ing.unit}` : '适量'}
                        </span>
                      </div>
                    )
                  })}
                </div>

                <div className="pt-2 border-t border-line space-y-2">
                  <p className="text-[12px] text-ink-3">
                    勾掉「已有」后，缺失食材共 <strong className="text-tint-deep">{missingIngredients.length}</strong> 项
                  </p>
                  <button
                    type="button"
                    onClick={() => void saveMissingToList()}
                    disabled={savingList || missingIngredients.length === 0}
                    className="btn-primary py-2.5 text-[13px]"
                  >
                    {savingList ? '保存中…' : '🛒 一键存入购物清单'}
                  </button>
                  {listSavedMsg && (
                    <p className="text-[12px] text-success font-medium text-center">
                      {listSavedMsg} · <Link href="/shopping-list" className="underline">去查看</Link>
                    </p>
                  )}
                </div>
              </>
            )}
          </section>
          )}
        </div>
      ) : null}
    </div>
  )
}
