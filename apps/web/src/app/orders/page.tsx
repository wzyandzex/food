import Link from 'next/link'
import { ORDER_SESSION_STATUS_LABELS, type OrderSessionStatus } from '@kaifan/shared'
import { createServerClient } from '@/lib/supabase'

interface OrderSessionItem {
  id: string
  title: string
  deadline: string
  status: string
  share_tokens: Array<{ token: string }>
  order_entries: Array<{
    orderer_nickname: string
    items: Array<{ recipeId?: string; freeText?: string; note?: string }>
  }>
}

async function fetchHostOrders(): Promise<OrderSessionItem[]> {
  try {
    const supabase = createServerClient()
    const { data, error } = await supabase
      .from('order_sessions')
      .select('id, title, deadline, status, share_tokens(token), order_entries(orderer_nickname, items)')
      .order('created_at', { ascending: false })
      .limit(20)

    if (error || !data) return []
    return data as unknown as OrderSessionItem[]
  } catch {
    return []
  }
}

export default async function OrdersListPage() {
  const orders = await fetchHostOrders()

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
        <Link
          href="/orders/new"
          className="rounded-xl bg-brand px-4 py-2 text-xs font-semibold text-white shadow-sm active:scale-95"
        >
          + 发起点单
        </Link>
      </header>

      {orders.length === 0 ? (
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
            const token = order.share_tokens?.[0]?.token
            const statusLabel =
              ORDER_SESSION_STATUS_LABELS[order.status as OrderSessionStatus] ?? order.status

            const totalEntries = order.order_entries?.length || 0

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
                    截止：{new Date(order.deadline).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span>已收到 {totalEntries} 人点单</span>
                </div>

                {/* 点单人明细汇总 */}
                {totalEntries > 0 && (
                  <div className="rounded-xl bg-neutral-50 p-3 text-xs space-y-1.5">
                    {order.order_entries.map((entry, eIdx) => (
                      <div key={eIdx} className="flex gap-2">
                        <span className="font-semibold text-ink/80">{entry.orderer_nickname}:</span>
                        <span className="text-ink/60">
                          {entry.items.map((it) => it.freeText || it.recipeId).join('、')}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {token && (
                  <div className="pt-1 flex gap-2">
                    <Link
                      href={`/o/${token}`}
                      className="flex-1 rounded-lg bg-neutral-100 py-2 text-center text-xs font-medium text-ink/70"
                    >
                      查看点单页
                    </Link>
                    <Link
                      href={`/orders/${order.id}`}
                      className="flex-1 rounded-lg bg-brand-soft py-2 text-center text-xs font-medium text-brand-deep"
                    >
                      汇总与采购清单
                    </Link>
                  </div>
                )}
              </article>
            )
          })}
        </section>
      )}
    </main>
  )
}
