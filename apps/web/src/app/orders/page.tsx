'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ORDER_SESSION_STATUS_LABELS, type OrderSessionStatus } from '@kaifan/shared'

import { useAuth } from '@/components/auth-provider'
import { getBrowserClient, isSupabaseConfigured } from '@/lib/supabase'

interface OrderSessionItem {
  id: string
  title: string
  deadline: string
  status: string
}

interface ParticipatedItem {
  sessionId: string
  title: string
  status: string
  deadline: string
  myDishCount: number
}

export default function OrdersListPage() {
  const { user, loading: authLoading, getAccessToken } = useAuth()
  // 双维点单记录（PRD §4.5）：我发起的 / 我参与的
  const [tab, setTab] = useState<'hosted' | 'participated'>('hosted')
  const [orders, setOrders] = useState<OrderSessionItem[]>([])
  const [participated, setParticipated] = useState<ParticipatedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    if (authLoading) return
    if (!user || !isSupabaseConfigured()) {
      setLoading(false)
      return
    }

    setLoading(true)
    setLoadError('')

    // 我发起的：走 anon key + 登录态，RLS（order_sessions_host）只放行我发起的会话；
    // 不查询 share_tokens / order_entries（无 RLS 放行策略，明细进详情页看）
    const hostedQuery = getBrowserClient()
      .from('order_sessions')
      .select('id, title, deadline, status')
      .order('created_at', { ascending: false })
      .limit(20)
      .then(({ data, error }) => {
        if (error) throw error
        setOrders((data as unknown as OrderSessionItem[]) ?? [])
      })

    // 我参与的：经服务端校验身份后按 orderer_user_id 查询
    const participatedQuery = (async () => {
      const token = await getAccessToken()
      if (!token) return
      const res = await fetch('/api/orders/participated', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) return
      const body = (await res.json()) as { items?: ParticipatedItem[] }
      setParticipated(body.items ?? [])
    })()

    void Promise.allSettled([hostedQuery, participatedQuery]).then((results) => {
      const failed = results.find((r) => r.status === 'rejected') as PromiseRejectedResult | undefined
      if (failed) {
        console.error('点单列表查询失败：', failed.reason)
        setLoadError('点单列表加载失败，请稍后重试')
      }
      setLoading(false)
    })
  }, [user, authLoading, getAccessToken])

  return (
    <main className="mx-auto min-h-dvh w-full max-w-md px-5 pt-10 pb-16">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <Link href="/" className="mb-1 inline-block text-xs text-ink/50">
            ← 返回首页
          </Link>
          <h1 className="text-xl font-bold">点单广场</h1>
          <p className="text-xs text-ink/60">发起与管理点单会话</p>
        </div>
        {user && (
          <Link
            href="/orders/new"
            className="rounded-xl bg-brand px-4 py-2 text-xs font-semibold text-white shadow-sm active:scale-95"
          >
            + 发起点单
          </Link>
        )}
      </header>

      {user && !authLoading && (
        <div className="mb-4 flex gap-1 rounded-xl bg-white p-1 shadow-sm">
          {(
            [
              { key: 'hosted', label: '我发起的' },
              { key: 'participated', label: '我参与的' },
            ] as const
          ).map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
              className={`flex-1 rounded-lg py-1.5 text-xs font-medium ${
                tab === item.key ? 'bg-brand text-white' : 'text-ink/60'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}

      {authLoading || loading ? (
        <p className="rounded-2xl bg-white p-8 text-center text-sm text-ink/50 shadow-sm">加载中…</p>
      ) : !user ? (
        <section className="rounded-2xl bg-white p-8 text-center shadow-sm space-y-3">
          <p className="text-3xl">🔒</p>
          <h2 className="text-sm font-semibold">登录后管理你的点单</h2>
          <p className="text-xs text-ink/50 leading-5">
            发起点单需要登录身份；参与点菜无需登录（凭分享链接）
          </p>
          <Link
            href="/login"
            className="inline-block rounded-xl bg-brand px-5 py-2.5 text-xs font-semibold text-white shadow-sm"
          >
            去登录 / 注册
          </Link>
        </section>
      ) : loadError ? (
        <p className="rounded-2xl border border-red-200 bg-red-50 p-4 text-center text-xs text-red-600">
          {loadError}
        </p>
      ) : tab === 'participated' ? (
        participated.length === 0 ? (
          <section className="rounded-2xl bg-white p-8 text-center shadow-sm space-y-3">
            <p className="text-3xl">🥢</p>
            <h2 className="text-sm font-semibold">还没有参与过点单</h2>
            <p className="text-xs text-ink/50 leading-5">
              收到家人朋友的分享链接后去点菜，这里就会记录你参与的每一顿
            </p>
          </section>
        ) : (
          <section className="space-y-4">
            {participated.map((item) => {
              const statusLabel =
                ORDER_SESSION_STATUS_LABELS[item.status as OrderSessionStatus] ?? item.status
              return (
                <article key={item.sessionId} className="rounded-2xl bg-white p-5 shadow-sm space-y-3">
                  <div className="flex items-center justify-between border-b border-neutral-100 pb-2">
                    <h2 className="font-bold text-sm text-ink">{item.title}</h2>
                    <span className="rounded-full bg-brand-soft px-2 py-0.5 text-xs font-medium text-brand-deep">
                      {statusLabel}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-ink/60">
                    <span>
                      截止：
                      {new Date(item.deadline).toLocaleString('zh-CN', {
                        month: 'numeric',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    <span>我点了 {item.myDishCount} 道</span>
                  </div>
                </article>
              )
            })}
          </section>
        )
      ) : orders.length === 0 ? (
        <section className="rounded-2xl bg-white p-8 text-center shadow-sm space-y-3">
          <p className="text-3xl">🍲</p>
          <h2 className="text-sm font-semibold">暂无发起的点单</h2>
          <p className="text-xs text-ink/50 leading-5">
            今晚做饭前，发个链接让家人朋友点选想吃的菜吧！
          </p>
          <Link
            href="/orders/new"
            className="inline-block rounded-xl bg-brand px-5 py-2.5 text-xs font-semibold text-white shadow-sm"
          >
            立即发起第一次点单
          </Link>
        </section>
      ) : (
        <section className="space-y-4">
          {orders.map((order) => {
            const statusLabel =
              ORDER_SESSION_STATUS_LABELS[order.status as OrderSessionStatus] ?? order.status

            return (
              <article key={order.id} className="rounded-2xl bg-white p-5 shadow-sm space-y-3">
                <div className="flex items-center justify-between border-b border-neutral-100 pb-2">
                  <h2 className="font-bold text-sm text-ink">{order.title}</h2>
                  <span className="rounded-full bg-brand-soft px-2 py-0.5 text-xs font-medium text-brand-deep">
                    {statusLabel}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs text-ink/60">
                  <span>
                    截止：
                    {new Date(order.deadline).toLocaleString('zh-CN', {
                      month: 'numeric',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>

                <div className="pt-1 flex gap-2">
                  <Link
                    href={`/orders/${order.id}`}
                    className="flex-1 rounded-lg bg-brand-soft py-2 text-center text-xs font-medium text-brand-deep"
                  >
                    汇总与采购清单
                  </Link>
                </div>
              </article>
            )
          })}
        </section>
      )}
    </main>
  )
}
