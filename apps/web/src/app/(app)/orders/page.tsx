'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ORDER_SESSION_STATUS_LABELS, type OrderSessionStatus } from '@kaifan/shared'

import { useAuth } from '@/components/auth-provider'
import { IconChevronRight, IconPlus } from '@/components/icons'
import { EmptyState, GroupedList, ListRow, LoginRequired, NavBar, Segmented } from '@/components/ui'
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

    const hostedQuery = getBrowserClient()
      .from('order_sessions')
      .select('id, title, deadline, status')
      .order('created_at', { ascending: false })
      .limit(20)
      .then(({ data, error }) => {
        if (error) throw error
        setOrders((data as unknown as OrderSessionItem[]) ?? [])
      })

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

  if (authLoading || loading) {
    return <main className="screen text-center text-xs text-ink-3 pt-20">加载中…</main>
  }

  if (!user) {
    return (
      <LoginRequired
        glyph="📝"
        title="需要先登录"
        description="发起点单需绑定身份；参与点菜只需分享链接"
      />
    )
  }

  const TAB_OPTIONS = [
    { value: 'hosted' as const, label: '我发起的' },
    { value: 'participated' as const, label: '我参与的' },
  ]

  return (
    <div className="screen">
      <NavBar
        title="点单广场"
        back="/me"
        backLabel="我的"
        action={
          <Link
            href="/orders/new"
            className="flex items-center gap-1 rounded-full bg-tint px-3 py-1 text-[13px] font-semibold text-white active:opacity-70"
          >
            <IconPlus className="size-3.5" />
            <span>发起</span>
          </Link>
        }
      />

      <div className="mt-3 mb-4">
        <Segmented options={TAB_OPTIONS} value={tab} onChange={setTab} />
      </div>

      {loadError && (
        <div className="card p-3 text-[12px] text-danger bg-danger-soft">{loadError}</div>
      )}

      {tab === 'hosted' ? (
        orders.length === 0 ? (
          <EmptyState
            glyph="🍲"
            title="暂无发起的点单"
            description="做饭前发个链接让家人朋友点菜，省去每天纠结的麻烦"
            action={
              <Link href="/orders/new" className="btn-primary">
                发起第一次点单
              </Link>
            }
          />
        ) : (
          <div className="list-group">
            {orders.map((order, idx) => {
              const statusLabel =
                ORDER_SESSION_STATUS_LABELS[order.status as OrderSessionStatus] ?? order.status
              const isLast = idx === orders.length - 1
              return (
                <Link
                  key={order.id}
                  href={`/orders/${order.id}`}
                  className={`flex items-center justify-between px-4 py-3.5 transition-colors active:bg-fill ${
                    isLast ? '' : 'border-b border-line'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-semibold text-ink">{order.title}</p>
                    <p className="mt-0.5 text-[12px] text-ink-3">
                      截止 {new Date(order.deadline).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <div className="ml-2 flex items-center gap-2">
                    <span className="rounded-md bg-tint-soft px-2 py-0.5 text-[11px] font-medium text-tint-deep">
                      {statusLabel}
                    </span>
                    <IconChevronRight className="size-4 text-ink-3/60" />
                  </div>
                </Link>
              )
            })}
          </div>
        )
      ) : participated.length === 0 ? (
        <EmptyState
          glyph="🥢"
          title="还没有参与过点单"
          description="收到好友的点单链接后去点菜，这里就会记录每一顿"
        />
      ) : (
        <div className="list-group">
          {participated.map((item, idx) => {
            const statusLabel =
              ORDER_SESSION_STATUS_LABELS[item.status as OrderSessionStatus] ?? item.status
            const isLast = idx === participated.length - 1
            return (
              <div
                key={item.sessionId}
                className={`flex items-center justify-between px-4 py-3.5 ${isLast ? '' : 'border-b border-line'}`}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold text-ink">{item.title}</p>
                  <p className="mt-0.5 text-[12px] text-ink-3">
                    我点了 {item.myDishCount} 道 · 截止 {new Date(item.deadline).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <span className="rounded-md bg-fill px-2 py-0.5 text-[11px] font-medium text-ink-2">
                  {statusLabel}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
