'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import type { CookingStats } from '@/app/api/stats/cooking/route'
import { MEAL_TYPE_LABELS, MEAL_TYPES, type MealType } from '@kaifan/shared'
import { useAuth } from '@/components/auth-provider'
import { PosterModal } from './poster-modal'

type TimeRange = 'month' | 'halfYear' | 'all'

const RANK_BADGES = ['🥇', '🥈', '🥉']

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
    return (
      <main className="mx-auto min-h-dvh w-full max-w-md px-5 pt-10 pb-16 text-center text-xs text-ink/50">
        正在计算你的做饭数据…
      </main>
    )
  }

  if (!user) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center px-6 text-center">
        <div className="mb-3 text-4xl">📊</div>
        <h1 className="mb-2 text-xl font-bold">需要先登录</h1>
        <p className="mb-6 text-sm text-ink/60">统计看板展示你的个人做饭数据</p>
        <Link href="/login" className="rounded-xl bg-brand px-6 py-3 font-semibold text-white shadow-sm">
          前往登录 / 注册
        </Link>
      </main>
    )
  }

  if (error || !stats) {
    return (
      <main className="mx-auto min-h-dvh w-full max-w-md px-5 pt-10 pb-16">
        <header className="mb-6">
          <Link href="/" className="mb-1 inline-block text-xs text-ink/50">← 返回首页</Link>
          <h1 className="text-xl font-bold">📊 统计看板</h1>
        </header>
        <div className="rounded-2xl bg-white p-8 text-center shadow-sm space-y-4">
          <p className="text-3xl">😵</p>
          <p className="text-xs leading-5 text-red-600">{error || '暂无数据'}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-xl bg-brand px-5 py-2.5 text-xs font-semibold text-white shadow-sm"
          >
            重试
          </button>
        </div>
      </main>
    )
  }

  const totalTrendSessions = stats.monthlyTrend.reduce((sum, row) => sum + row.sessions, 0)
  const showTrend = range !== 'month' && totalTrendSessions > 0
  const maxTrendValue = Math.max(1, ...stats.monthlyTrend.map((row) => row.sessions))
  const mealTotal = Object.values(stats.mealTypeDist).reduce((a, b) => a + b, 0)

  // 英雄区数字随视角切换
  const heroCount =
    range === 'month' ? stats.totals.monthCount : range === 'halfYear' ? totalTrendSessions : stats.totals.totalSessions
  const heroLabel = range === 'month' ? '这个月做了几顿' : range === 'halfYear' ? '近 6 个月做了几顿' : '累计做了几顿'

  return (
    <main className="mx-auto min-h-dvh w-full max-w-md px-5 pt-10 pb-16">
      <header className="mb-5 flex items-center justify-between">
        <div>
          <Link href="/" className="mb-1 inline-block text-xs text-ink/50">← 返回首页</Link>
          <h1 className="text-xl font-bold">📊 统计看板</h1>
          <p className="text-xs text-ink/60">你的做饭足迹与口味画像</p>
        </div>
        <span className="rounded-full bg-brand-soft px-2.5 py-0.5 text-[11px] font-semibold text-brand-deep">
          🔥 连续做饭 {stats.streaks.currentStreakDays} 天
        </span>
      </header>

      {/* 时间视角分段切换 */}
      <div className="mb-4 flex gap-1 rounded-xl bg-white p-1 shadow-sm">
        {(
          [
            ['month', '本月'],
            ['halfYear', '近 6 月'],
            ['all', '全部'],
          ] as Array<[TimeRange, string]>
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setRange(value)}
            className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition ${
              range === value ? 'bg-brand text-white shadow-sm' : 'text-ink/60'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 英雄区大数字 */}
      <section className="mb-3 rounded-2xl bg-brand p-5 text-white shadow-sm">
        <p className="text-xs opacity-85">{heroLabel}</p>
        <p className="mt-1 font-bold tracking-tight">
          <span className="align-baseline text-5xl">{heroCount}</span>
          <span className="ml-1 align-baseline text-sm opacity-80">顿</span>
        </p>
        <p className="mt-2 text-[11px] leading-4 opacity-75">
          最长连续纪录 {stats.streaks.longestStreakDays} 天 · 累计做菜 {stats.totals.totalDishes} 道 · 留影{' '}
          {stats.totals.totalPhotos} 张
        </p>
      </section>

      {/* 四宫格 KPI */}
      <section className="mb-4 grid grid-cols-2 gap-2.5">
        {[
          { label: '总顿次', value: String(stats.totals.totalSessions), unit: '顿' },
          { label: '新菜尝试', value: String(stats.newDishCount), unit: '道' },
          {
            label: '平均评分',
            value: stats.totals.avgRating != null ? stats.totals.avgRating.toFixed(1) : '--',
            unit: '分 ⭐',
          },
          {
            label: '来自点单',
            value:
              stats.totals.orderLinkedRatio != null ? `${Math.round(stats.totals.orderLinkedRatio * 100)}%` : '--',
            unit: '',
          },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded-2xl bg-white p-4 shadow-sm">
            <p className="text-[11px] text-ink/55">{kpi.label}</p>
            <p className="mt-1 font-bold text-brand-deep">
              <span className="text-2xl">{kpi.value}</span>
              {kpi.unit && <span className="ml-0.5 text-xs text-ink/50">{kpi.unit}</span>}
            </p>
          </div>
        ))}
      </section>

      {/* 月度趋势柱状图（纯 CSS） */}
      {showTrend && (
        <section className="mb-4 rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-bold text-ink">📈 月度趋势</h2>
          <div className="flex h-32 items-end justify-between gap-1.5">
            {stats.monthlyTrend.map((row, index) => {
              const isCurrentMonth = index === stats.monthlyTrend.length - 1
              const heightPercent = Math.max(4, Math.round((row.sessions / maxTrendValue) * 100))
              return (
                <div key={row.month} className="flex flex-1 flex-col items-center gap-1">
                  <span className="text-[9px] font-semibold text-ink/60">{row.sessions > 0 ? row.sessions : ''}</span>
                  <div className="flex h-full w-full items-end">
                    <div
                      className={`w-full rounded-t-md transition-all ${isCurrentMonth ? 'bg-brand' : 'bg-brand/30'}`}
                      style={{ height: `${heightPercent}%` }}
                    />
                  </div>
                  <span className={`text-[9px] ${isCurrentMonth ? 'font-bold text-brand-deep' : 'text-ink/45'}`}>
                    {monthLabel(row.month)}
                  </span>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* 最常做的菜 Top10 */}
      <section className="mb-4 rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-bold text-ink">🏆 最常做的菜 Top10</h2>
        {stats.topDishes.length === 0 ? (
          <p className="py-4 text-center text-xs text-ink/40">还没有做饭记录，快去记第一顿吧！</p>
        ) : (
          <ol className="space-y-2.5">
            {stats.topDishes.map((dish, index) => {
              const widthPercent = Math.round((dish.count / Math.max(1, stats.topDishes[0]?.count ?? 1)) * 100)
              const rankBadge = index < 3 ? RANK_BADGES[index] : <span className="text-[11px] text-ink/45">{index + 1}</span>
              const content = (
                <>
                  <span className="flex w-7 shrink-0 items-center justify-center">{rankBadge}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-xs font-medium text-ink">{dish.title}</span>
                      <span className="shrink-0 text-[10px] text-brand-deep">{dish.count} 次</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-neutral-100">
                      <div className="h-full rounded-full bg-brand/70" style={{ width: `${widthPercent}%` }} />
                    </div>
                  </div>
                </>
              )
              return dish.recipeId ? (
                <li key={dish.title}>
                  <Link
                    href={`/recipes/${encodeURIComponent(dish.recipeId)}`}
                    className="flex items-center gap-2.5 active:opacity-70"
                  >
                    {content}
                  </Link>
                </li>
              ) : (
                <li key={dish.title} className="flex items-center gap-2.5">
                  {content}
                </li>
              )
            })}
          </ol>
        )}
      </section>

      {/* 餐次分布堆叠条 */}
      {mealTotal > 0 && (
        <section className="mb-4 rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-bold text-ink">🍳 餐次分布</h2>
          <div className="flex h-3 overflow-hidden rounded-full">
            {(MEAL_TYPES as readonly MealType[]).map((mealType, index) => {
              const value = stats.mealTypeDist[mealType]
              if (value === 0) return null
              const colors = ['#d9480f', '#e8590c', '#f76707', '#ff922b']
              return (
                <div
                  key={mealType}
                  style={{ width: `${(value / mealTotal) * 100}%`, backgroundColor: colors[index] }}
                  title={`${MEAL_TYPE_LABELS[mealType]} ${value} 顿`}
                />
              )
            })}
          </div>
          <div className="mt-3 grid grid-cols-4 gap-1 text-center">
            {(MEAL_TYPES as readonly MealType[]).map((mealType) => (
              <div key={mealType}>
                <p className="text-[10px] text-ink/50">{MEAL_TYPE_LABELS[mealType]}</p>
                <p className="text-xs font-bold text-ink">{stats.mealTypeDist[mealType]}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 分享海报 */}
      <button
        type="button"
        onClick={() => setShowPoster(true)}
        disabled={stats.totals.totalSessions === 0}
        className="w-full rounded-2xl bg-brand py-4 text-center font-semibold text-white shadow-sm disabled:opacity-50 active:scale-[0.99]"
      >
        🎨 生成我的做饭分享海报
      </button>

      {showPoster && <PosterModal stats={stats} nickname="美食家" onClose={() => setShowPoster(false)} />}

      <footer className="mt-8 text-center text-xs text-ink/40">开饭 KaiFan · 数据仅自己可见</footer>
    </main>
  )
}
