'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { MEAL_TYPE_LABELS, type MealType } from '@kaifan/shared'

import { useAuth } from '@/components/auth-provider'
import { IconChart, IconPlus } from '@/components/icons'
import { EmptyState, LoginRequired, PageHeader, Segmented } from '@/components/ui'
import { getBrowserClient, isSupabaseConfigured } from '@/lib/supabase'

interface DishRow {
  snapshot_title: string
  photos: string[]
  adjust_note: string | null
}

interface CookSessionRow {
  id: string
  date: string
  meal_type: string
  note: string | null
  rating: number | null
  cook_dishes: DishRow[]
}

export default function LogsPage() {
  const { user, loading: authLoading } = useAuth()
  const [logs, setLogs] = useState<CookSessionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [range, setRange] = useState<'day' | 'week' | 'month'>('week')

  useEffect(() => {
    if (authLoading) return
    if (!user || !isSupabaseConfigured()) {
      setLoading(false)
      return
    }

    setLoading(true)
    const days = range === 'day' ? 1 : range === 'week' ? 7 : 30
    const cutoff = new Date(Date.now() - (days - 1) * 24 * 3600 * 1000)
      .toISOString()
      .slice(0, 10)

    getBrowserClient()
      .from('cook_sessions')
      .select('id, date, meal_type, note, rating, cook_dishes(snapshot_title, photos, adjust_note)')
      .gte('date', cutoff)
      .order('date', { ascending: false })
      .then(({ data, error }) => {
        if (error) {
          console.error('做饭日志查询失败：', error.message)
          setLoadError('日志加载失败，请稍后重试')
        } else {
          setLogs((data as unknown as CookSessionRow[]) ?? [])
        }
        setLoading(false)
      })
  }, [user, authLoading, range])

  const groupedLogs = logs.reduce<Map<string, CookSessionRow[]>>((acc, log) => {
    const list = acc.get(log.date) ?? []
    list.push(log)
    acc.set(log.date, list)
    return acc
  }, new Map())

  const RANGE_OPTIONS = [
    { value: 'day' as const, label: '今天' },
    { value: 'week' as const, label: '近 7 天' },
    { value: 'month' as const, label: '近 30 天' },
  ]

  if (authLoading || loading) {
    return <main className="screen text-center text-xs text-ink-3 pt-20">加载中…</main>
  }

  if (!user) {
    return (
      <LoginRequired
        glyph="🍳"
        title="登录后查看做饭记录"
        description="做饭记录是你的私人饮食日志，默认仅自己可见"
      />
    )
  }

  return (
    <div className="screen">
      <PageHeader
        title="记录"
        subtitle="回溯每一顿的温度与味道"
        action={
          <div className="flex items-center gap-2">
            <Link
              href="/stats"
              className="flex size-8 items-center justify-center rounded-full bg-fill text-ink-2 transition active:opacity-70"
              aria-label="统计看板"
            >
              <IconChart className="size-4.5" />
            </Link>
            <Link
              href="/logs/new"
              className="flex items-center gap-1 rounded-full bg-tint px-3 py-1.5 text-[13px] font-semibold text-white transition active:opacity-70"
            >
              <IconPlus className="size-4" />
              <span>记一顿</span>
            </Link>
          </div>
        }
      />

      {/* 时间范围切换 */}
      <div className="mb-4">
        <Segmented options={RANGE_OPTIONS} value={range} onChange={setRange} />
      </div>

      {loadError ? (
        <div className="card p-4 text-center text-xs text-danger bg-danger-soft">{loadError}</div>
      ) : logs.length === 0 ? (
        <EmptyState
          glyph="🍳"
          title="这个时间段还没有记录"
          description="换一个时间范围，或者记下刚吃过的一顿吧"
          action={
            <Link
              href="/logs/new"
              className="btn-primary"
            >
              记下今天这顿
            </Link>
          }
        />
      ) : (
        <div className="space-y-6">
          {Array.from(groupedLogs.entries()).map(([logDate, dayLogs]) => (
            <div key={logDate} className="space-y-2">
              <div className="flex items-baseline justify-between px-1">
                <h2 className="text-[13px] font-medium text-ink-3">
                  {logDate}
                </h2>
                <span className="text-[12px] text-ink-3">{dayLogs.length} 顿</span>
              </div>

              <div className="list-group">
                {dayLogs.map((log, logIdx) => {
                  const mealLabel = MEAL_TYPE_LABELS[log.meal_type as MealType] ?? log.meal_type
                  const isLast = logIdx === dayLogs.length - 1
                  return (
                    <article
                      key={log.id}
                      className={`p-4 ${isLast ? '' : 'border-b border-line'}`}
                    >
                      {/* 餐次 + 评分 */}
                      <div className="flex items-center justify-between">
                        <span className="rounded-md bg-tint-soft px-2 py-0.5 text-[12px] font-medium text-tint-deep">
                          {mealLabel}
                        </span>
                        {log.rating && (
                          <span className="text-[12px] text-ink-3">
                            {'★'.repeat(log.rating)}
                          </span>
                        )}
                      </div>

                      {/* 菜品清单 */}
                      <div className="mt-3 space-y-2">
                        {(log.cook_dishes ?? []).map((dish, idx) => (
                          <div key={idx} className="text-[14px]">
                            <p className="font-semibold text-ink">{dish.snapshot_title}</p>
                            {dish.adjust_note && (
                              <p className="mt-0.5 text-[12px] text-ink-2 italic">
                                💡 {dish.adjust_note}
                              </p>
                            )}
                            {dish.photos && dish.photos.length > 0 && (
                              <div className="mt-2 flex gap-2 overflow-x-auto no-scrollbar">
                                {dish.photos.map((p, pIdx) => (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    key={pIdx}
                                    src={p}
                                    alt="菜品照"
                                    className="size-16 shrink-0 rounded-lg object-cover bg-fill"
                                  />
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* 总体心得 */}
                      {log.note && (
                        <p className="mt-3 rounded-lg bg-fill p-2.5 text-[12px] leading-5 text-ink-2">
                          💭 {log.note}
                        </p>
                      )}
                    </article>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
