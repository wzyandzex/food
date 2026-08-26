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

export default function OrdersListPage() {
  const { user, loading: authLoading } = useAuth()
  const [orders, setOrders] = useState<OrderSessionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    if (authLoading) return
    if (!user || !isSupabaseConfigured()) {
      setLoading(false)
      return
    }

    // 走 anon key + 登录态：RLS（order_sessions_host）只放行我发起的会话；
    // 不查询 share_tokens / order_entries（无 RLS 放行策略，明细进详情页看）
    getBrowserClient()
      .from('order_sessions')
      .select('id, title, deadline, status')
      .order('created_at', { ascending: false })
      .limit(20)
      .then(({ data, error }) => {
        if (error) {
          console.error('点单列表查询失败：', error.message)
          setLoadError('点单列表加载失败，请稍后重试')
        } else {
          setOrders((data as unknown as OrderSessionItem[]) ?? [])
        }
        setLoading(false)
      })
  }, [user, authLoading])

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
