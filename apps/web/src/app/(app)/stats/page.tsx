'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import type { CookingStats } from '@kaifan/shared'
import { MEAL_TYPE_LABELS, MEAL_TYPES, type MealType } from '@kaifan/shared'
import { useAuth } from '@/components/auth-provider'
import { IconFlame } from '@/components/icons'
import { GroupedList, ListRow, LoginRequired, NavBar, Segmented } from '@/components/ui'
import { PosterModal } from './poster-modal'

type TimeRange = 'month' | 'halfYear' | 'all'

function monthLabel(ym: string): string {
  const [, m] = ym.split('-')
  return `${Number(m)}月`
}

export default function StatsPage() {
  const { user, loading, getAccessToken } = useAuth()
  const [stats, setStats] = useState<CookingStats | null>(null)
  const [fetching, setFetching] = useState(true)
  const [error, setError] = useState('')
  const [range, setRange] = useState<TimeRange>('month')
  const [showPoster, setShowPoster] = useState(false)

  useEffect(() => {
    if (loading) return
    if (!user) {
      setFetching(false)
      return
    }

    void (async () => {
      setFetching(true)
      setError('')
      try {
        const token = await getAccessToken()
        if (!token) throw new Error('登录状态已失效，请重新登录')

        const res = await fetch('/api/stats/cooking?months=6', {
          headers: { Authorization: `Bearer ${token}` },
        })
        const body = (await res.json()) as { stats?: CookingStats; error?: string }
        if (!res.ok || !body.stats) throw new Error(body.error || '加载统计失败')
        setStats(body.stats)
      } catch (err) {
        setError((err as Error).message)
      } finally {
        setFetching(false)
      }
    })()
  }, [loading, user, getAccessToken])

  if (loading || fetching) {
    return <main className="screen text-center text-xs text-ink-3 pt-20">正在计算做饭数据…</main>
  }

  if (!user) {
    return (
      <LoginRequired
        glyph="📊"
        title="需要先登录"
        description="统计看板展示你的个人做饭数据画像"
      />
    )
  }

  if (error || !stats) {
    return (
      <div className="screen">
        <NavBar title="统计" back="/me" backLabel="我的" />
        <div className="card mt-6 p-6 text-center space-y-3">
          <p className="text-xs text-danger">{error || '暂无数据'}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-xl bg-tint px-4 py-2 text-xs font-semibold text-white"
          >
            重试
          </button>
        </div>
      </div>
    )
  }

  const totalTrendSessions = stats.monthlyTrend.reduce((sum, row) => sum + row.sessions, 0)
  const showTrend = range !== 'month' && totalTrendSessions > 0
  const maxTrendValue = Math.max(1, ...stats.monthlyTrend.map((row) => row.sessions))
  const mealTotal = Object.values(stats.mealTypeDist).reduce((a, b) => a + b, 0)

  const heroCount =
    range === 'month' ? stats.totals.monthCount : range === 'halfYear' ? totalTrendSessions : stats.totals.totalSessions
  const heroLabel = range === 'month' ? '本月做饭' : range === 'halfYear' ? '近 6 个月做饭' : '累计做饭'

  const RANGE_OPTIONS = [
    { value: 'month' as const, label: '本月' },
    { value: 'halfYear' as const, label: '近 6 月' },
    { value: 'all' as const, label: '全部' },
  ]

  return (
    <div className="screen">
      <NavBar title="统计" back="/me" backLabel="我的" />

      {/* 视角切换 */}
      <div className="mt-3 mb-4">
        <Segmented options={RANGE_OPTIONS} value={range} onChange={setRange} />
      </div>

      {/* Apple Health 风格的大数字焦点 */}
      <section className="card p-5">
        <p className="text-[13px] font-medium text-ink-3">{heroLabel}</p>
        <div className="mt-1 flex items-baseline gap-1.5">
          <span className="text-[44px] font-bold tracking-tight text-ink">{heroCount}</span>
          <span className="text-[17px] font-medium text-ink-2">顿</span>
        </div>
        <div className="mt-3 flex items-center gap-1.5 text-[12px] text-tint-deep">
          <IconFlame className="size-4" />
          <span>连续做饭 <strong>{stats.streaks.currentStreakDays}</strong> 天（最长 {stats.streaks.longestStreakDays} 天）</span>
        </div>
      </section>

      {/* 四项精简指标 */}
      <div className="mt-3 grid grid-cols-2 gap-2.5">
        <div className="card p-4">
          <p className="text-[12px] text-ink-3">累计做菜</p>
          <p className="mt-1 text-[22px] font-bold text-ink">
            {stats.totals.totalDishes} <span className="text-[12px] font-normal text-ink-3">道</span>
          </p>
        </div>
        <div className="card p-4">
          <p className="text-[12px] text-ink-3">新菜尝试</p>
          <p className="mt-1 text-[22px] font-bold text-ink">
            {stats.newDishCount} <span className="text-[12px] font-normal text-ink-3">道</span>
          </p>
        </div>
        <div className="card p-4">
          <p className="text-[12px] text-ink-3">平均评分</p>
          <p className="mt-1 text-[22px] font-bold text-ink">
            {stats.totals.avgRating != null ? stats.totals.avgRating.toFixed(1) : '--'}
            <span className="ml-1 text-[12px] font-normal text-ink-3">分</span>
          </p>
        </div>
        <div className="card p-4">
          <p className="text-[12px] text-ink-3">留影记录</p>
          <p className="mt-1 text-[22px] font-bold text-ink">
            {stats.totals.totalPhotos} <span className="text-[12px] font-normal text-ink-3">张</span>
          </p>
        </div>
      </div>

      {/* 月度趋势（精简柱状图） */}
      {showTrend && (
        <section className="card mt-4 p-4">
          <h2 className="text-[13px] font-medium text-ink-3 mb-3">月度趋势</h2>
          <div className="flex h-24 items-end justify-between gap-2">
            {stats.monthlyTrend.map((row, index) => {
              const isCurrentMonth = index === stats.monthlyTrend.length - 1
              const heightPercent = Math.max(6, Math.round((row.sessions / maxTrendValue) * 100))
              return (
                <div key={row.month} className="flex flex-1 flex-col items-center gap-1.5">
                  <span className="text-[10px] text-ink-3">{row.sessions > 0 ? row.sessions : ''}</span>
                  <div className="flex h-full w-full items-end">
                    <div
                      className={`w-full rounded-t ${isCurrentMonth ? 'bg-tint' : 'bg-fill-strong'}`}
                      style={{ height: `${heightPercent}%` }}
                    />
                  </div>
                  <span className={`text-[10px] ${isCurrentMonth ? 'font-semibold text-tint' : 'text-ink-3'}`}>
                    {monthLabel(row.month)}
                  </span>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* 最常做的菜 Top 列表 */}
      <GroupedList header="最常做的菜 Top10">
        {stats.topDishes.length === 0 ? (
          <div className="p-6 text-center text-[13px] text-ink-3">还没有记录</div>
        ) : (
          stats.topDishes.map((dish, index) => {
            const isLast = index === stats.topDishes.length - 1
            const badge = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}`
            return (
              <ListRow
                key={dish.title}
                icon={<span className="text-[14px] font-semibold text-ink-3 w-5 text-center">{badge}</span>}
                title={dish.title}
                right={<span className="text-[13px] font-medium text-ink-2">{dish.count} 次</span>}
                href={dish.recipeId ? `/recipes/${encodeURIComponent(dish.recipeId)}` : undefined}
                last={isLast}
              />
            )
          })
        )}
      </GroupedList>

      {/* 餐次分布 */}
      {mealTotal > 0 && (
        <section className="card mt-4 p-4">
          <h2 className="text-[13px] font-medium text-ink-3 mb-2.5">餐次分布</h2>
          <div className="flex h-2.5 overflow-hidden rounded-full bg-fill">
            {(MEAL_TYPES as readonly MealType[]).map((mealType) => {
              const value = stats.mealTypeDist[mealType]
              if (value === 0) return null
              const colors: Record<MealType, string> = {
                breakfast: '#f59e0b',
                lunch: '#d9480f',
                dinner: '#7c3aed',
                supper: '#2563eb',
              }
              return (
                <div
                  key={mealType}
                  style={{ width: `${(value / mealTotal) * 100}%`, backgroundColor: colors[mealType] }}
                />
              )
            })}
          </div>
          <div className="mt-2.5 grid grid-cols-4 gap-1 text-center">
            {(MEAL_TYPES as readonly MealType[]).map((mealType) => (
              <div key={mealType}>
                <p className="text-[11px] text-ink-3">{MEAL_TYPE_LABELS[mealType]}</p>
                <p className="text-[13px] font-semibold text-ink">{stats.mealTypeDist[mealType]}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 生成海报 */}
      <div className="mt-6">
        <button
          type="button"
          onClick={() => setShowPoster(true)}
          disabled={stats.totals.totalSessions === 0}
          className="btn-tonal"
        >
          🎨 生成做饭月报海报
        </button>
      </div>

      {showPoster && (
        <PosterModal
          stats={stats}
          nickname={user.user_metadata?.nickname || '美食家'}
          onClose={() => setShowPoster(false)}
        />
      )}
    </div>
  )
}
