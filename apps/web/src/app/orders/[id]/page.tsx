import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createServerClient } from '@/lib/supabase'

interface OrderDetailData {
  id: string
  title: string
  deadline: string
  status: string
  entries: Array<{
    nickname: string
    items: Array<{ recipeId?: string; freeText?: string; servings?: number; note?: string }>
  }>
  ingredientsSummary: Array<{ name: string; qty: number; unit: string }>
}

async function fetchOrderDetail(id: string): Promise<OrderDetailData | null> {
  try {
    const supabase = createServerClient()
    const { data: session, error } = await supabase
      .from('order_sessions')
      .select('id, title, deadline, status, order_entries(orderer_nickname, items)')
      .eq('id', id)
      .single()

    if (error || !session) return null

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawEntries = (session.order_entries as any[]) || []
    const entries = rawEntries.map((e) => ({
      nickname: e.orderer_nickname,
      items: e.items || [],
    }))

    // 收集所有被点的 Recipe ID
    const recipeIds: string[] = []
    for (const e of entries) {
      for (const item of e.items) {
        if (item.recipeId) recipeIds.push(item.recipeId)
      }
    }

    // 汇总食材
    const ingredientsSummary: Array<{ name: string; qty: number; unit: string }> = []
    if (recipeIds.length > 0) {
      const { data: recipeIngs } = await supabase
        .from('recipe_ingredients')
        .select('qty, unit, ingredients(name)')
        .in('recipe_id', recipeIds)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rows = (recipeIngs as any[]) || []
      const map = new Map<string, { qty: number; unit: string }>()
      for (const row of rows) {
        const name = row.ingredients?.name
        if (!name) continue
        const current = map.get(name) || { qty: 0, unit: row.unit || '' }
        current.qty += Number(row.qty) || 1
        map.set(name, current)
      }

      for (const [name, val] of map.entries()) {
        ingredientsSummary.push({ name, qty: val.qty, unit: val.unit })
      }
    }

    return {
      id: session.id,
      title: session.title,
      deadline: session.deadline,
      status: session.status,
      entries,
      ingredientsSummary,
    }
  } catch {
    return null
  }
}

export default async function OrderSummaryPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const data = await fetchOrderDetail(id)

  if (!data) notFound()

  return (
    <main className="mx-auto min-h-dvh w-full max-w-md px-5 pt-10 pb-16">
      <header className="mb-6">
        <Link href="/orders" className="mb-2 inline-block text-xs text-ink/50">
          ← 返回点单列表
        </Link>
        <h1 className="text-xl font-bold">{data.title}</h1>
        <p className="text-xs text-ink/60">点单汇总与食材采购清单</p>
      </header>

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
                      🍽️ {it.freeText || it.recipeId} {it.note && <span className="text-brand-deep">（{it.note}）</span>}
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
    </main>
  )
}
