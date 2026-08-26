'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'

import { useAuth } from '@/components/auth-provider'

interface OrderItemLike {
  recipeId?: string
  freeText?: string
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
                          🍽️ {it.freeText || it.recipeId}{' '}
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
              <span className="text-xs text-ink/40">自动合并同名食材</span>
            </div>

            {data.ingredientsSummary.length === 0 ? (
              <p className="text-xs text-ink/40 leading-5">
                点单菜品暂无可提取的标准食材表（自由报菜名需手动采购）
              </p>
            ) : (
              <ul className="space-y-2 text-xs">
                {data.ingredientsSummary.map((ing, idx) => (
                  <li key={idx} className="flex justify-between items-center bg-neutral-50 p-2.5 rounded-lg">
                    <span className="font-medium text-ink">{ing.name}</span>
                    <span className="text-brand-deep font-semibold">
                      {ing.qty > 0 ? `${ing.qty} ${ing.unit}` : '适量'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </main>
  )
}
