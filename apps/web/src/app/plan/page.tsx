'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { MEAL_TYPES, MEAL_TYPE_LABELS, startOfWeek, toLocalDateKey, weekDates, type MealType } from '@kaifan/shared'
import { useAuth } from '@/components/auth-provider'
import { RecipePickerSheet, type PickerTarget } from './recipe-picker-sheet'

interface MealPlanEntry {
  id: string
  planDate: string
  mealType: MealType
  recipeId: string | null
  snapshotTitle: string
  note: string | null
  status: 'planned' | 'cooked' | 'skipped'
}

const WEEKDAY_NAMES = ['一', '二', '三', '四', '五', '六', '日']
const MEAL_EMOJI: Record<MealType, string> = { breakfast: '🌅', lunch: '☀️', dinner: '🌙', supper: '🌃' }

export default function PlanPage() {
  const { user, loading, getAccessToken } = useAuth()
  const [mondayOffsetWeeks, setMondayOffsetWeeks] = useState(0)
  const [entries, setEntries] = useState<Map<string, MealPlanEntry>>(new Map())
  const [fetching, setFetching] = useState(true)
  const [error, setError] = useState('')
  const [pickerTarget, setPickerTarget] = useState<PickerTarget | null>(null)

  const monday = useMemo(() => {
    const thisMonday = startOfWeek()
    return new Date(thisMonday.getFullYear(), thisMonday.getMonth(), thisMonday.getDate() + mondayOffsetWeeks * 7)
  }, [mondayOffsetWeeks])
  const dates = useMemo(() => weekDates(monday), [monday])
  const todayKey = toLocalDateKey()

  const loadPlan = useCallback(async () => {
    if (!user) return
    setError('')
    try {
      const token = await getAccessToken()
      if (!token) throw new Error('登录状态已失效')
      // 始终以本周一为锚点，服务端解析出完整自然周
      const res = await fetch(`/api/meal-plan?anchor=${dates[0] ?? toLocalDateKey(monday)}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const body = (await res.json()) as { entries?: MealPlanEntry[]; error?: string }
      if (!res.ok || !body.entries) throw new Error(body.error ?? '加载计划失败')

      const map = new Map<string, MealPlanEntry>()
      for (const entry of body.entries) {
        map.set(`${entry.planDate}__${entry.mealType}`, entry)
      }
      setEntries(map)
    } catch (err) {
      setError((err as Error).message)
    }
  }, [user, getAccessToken, dates, monday, todayKey])

  useEffect(() => {
    if (loading) return
    if (!user) {
      setFetching(false)
      return
    }
    void loadPlan().finally(() => setFetching(false))
  }, [loading, user, loadPlan])

  /** 写入一格安排 */
  const confirmPick = async (target: PickerTarget, recipeId: string | null, title: string) => {
    try {
      const token = await getAccessToken()
      if (!token) throw new Error('登录状态已失效')

      const res = await fetch('/api/meal-plan', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          planDate: target.planDate,
          mealType: target.mealType,
          recipeId,
          snapshotTitle: title,
        }),
      })
      if (!res.ok) {
        const body = (await res.json()) as { error?: string }
        throw new Error(body.error ?? '保存失败')
      }
      setPickerTarget(null)
      void loadPlan()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  /** 状态流转与删除 */
  const updateEntry = async (entry: MealPlanEntry, action: 'cooked' | 'skipped' | 'replan' | 'delete') => {
    try {
      const token = await getAccessToken()
      if (!token) throw new Error('登录状态已失效')

      if (action === 'delete') {
        const res = await fetch(`/api/meal-plan/${entry.id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) throw new Error('删除失败')
      } else if (action === 'replan') {
        const res = await fetch(`/api/meal-plan/${entry.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ status: 'planned' }),
        })
        if (!res.ok) throw new Error('更新失败')
      } else {
        const res = await fetch(`/api/meal-plan/${entry.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ status: action }),
        })
        if (!res.ok) {
          const body = (await res.json()) as { error?: string }
          throw new Error(body.error ?? '更新失败')
        }
      }
      void loadPlan()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const weekRangeLabel = `${Number(dates[0]?.slice(5, 7))}/${Number(dates[0]?.slice(8))} - ${Number(dates[6]?.slice(5, 7))}/${Number(dates[6]?.slice(8))}`
  const isCurrentWeek =
    mondayOffsetWeeks === 0

  if (loading || fetching) {
    return (
      <main className="mx-auto min-h-dvh w-full max-w-md px-5 pt-10 pb-16 text-center text-xs text-ink/50">
        正在拉取排餐计划…
      </main>
    )
  }

  if (!user) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center px-6 text-center">
        <div className="mb-3 text-4xl">📅</div>
        <h1 className="mb-2 text-xl font-bold">需要先登录</h1>
        <p className="mb-6 text-sm text-ink/60">排餐计划与账号绑定，登录后即可规划一周吃什么</p>
        <Link href="/login" className="rounded-xl bg-brand px-6 py-3 font-semibold text-white shadow-sm">
          前往登录 / 注册
        </Link>
      </main>
    )
  }

  return (
    <main className="mx-auto min-h-dvh w-full max-w-md px-5 pt-10 pb-16">
      <header className="mb-5 flex items-center justify-between">
        <div>
          <Link href="/" className="mb-1 inline-block text-xs text-ink/50">← 返回首页</Link>
          <h1 className="text-xl font-bold">📅 排餐计划</h1>
          <p className="text-xs text-ink/60">提前安排一周，到点照做不纠结</p>
        </div>
      </header>

      {/* 周切换 */}
      <div className="mb-4 flex items-center justify-between rounded-xl bg-white p-2 shadow-sm">
        <button
          type="button"
          onClick={() => setMondayOffsetWeeks((prev) => prev - 1)}
          className="rounded-lg px-3 py-1.5 text-xs font-medium text-ink/70 active:bg-neutral-100"
        >
          ‹ 上周
        </button>
        <span className={`text-sm font-bold ${isCurrentWeek ? 'text-brand-deep' : 'text-ink'}`}>
          {isCurrentWeek ? '本周' : ''} {weekRangeLabel}
        </span>
        <button
          type="button"
          onClick={() => setMondayOffsetWeeks((prev) => prev + 1)}
          className="rounded-lg px-3 py-1.5 text-xs font-medium text-ink/70 active:bg-neutral-100"
        >
          下周 ›
        </button>
      </div>

      {error && (
        <p className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">{error}</p>
      )}

      {/* 七张日卡 */}
      <section className="space-y-3">
        {dates.map((dateKey, index) => {
          const isToday = dateKey === todayKey
          const isPast = dateKey < todayKey
          return (
            <article
              key={dateKey}
              className={`rounded-2xl bg-white p-4 shadow-sm ${isToday ? 'border-2 border-brand' : ''}`}
            >
              <div className="mb-2.5 flex items-center gap-2 border-b border-neutral-100 pb-2">
                <span className={`text-sm font-bold ${isToday ? 'text-brand-deep' : 'text-ink'}`}>
                  周{WEEKDAY_NAMES[index]}
                </span>
                <span className="text-xs text-ink/45">{dateKey.slice(5)}</span>
                {isToday && (
                  <span className="rounded-full bg-brand px-2 py-0.5 text-[10px] font-bold text-white">今天</span>
                )}
              </div>

              <div className="space-y-1.5">
                {(MEAL_TYPES as readonly MealType[]).map((mealType) => {
                  const entry = entries.get(`${dateKey}__${mealType}`)
                  if (!entry) {
                    return isPast ? (
                      <div key={mealType} className="flex items-center justify-between rounded-lg bg-neutral-50/60 px-3 py-2">
                        <span className="text-xs text-ink/35">{MEAL_EMOJI[mealType]} {MEAL_TYPE_LABELS[mealType]}</span>
                        <span className="text-[10px] text-neutral-300">已过</span>
                      </div>
                    ) : (
                      <button
                        key={mealType}
                        type="button"
                        onClick={() => setPickerTarget({ planDate: dateKey, mealType })}
                        className="flex w-full items-center justify-between rounded-lg border border-dashed border-neutral-200 px-3 py-2 text-left active:border-brand/50"
                      >
                        <span className="text-xs text-ink/50">{MEAL_EMOJI[mealType]} {MEAL_TYPE_LABELS[mealType]}</span>
                        <span className="text-[11px] font-medium text-brand">+ 安排</span>
                      </button>
                    )
                  }

                  const statusStyle =
                    entry.status === 'cooked'
                      ? 'bg-green-50'
                      : entry.status === 'skipped'
                        ? 'opacity-55'
                        : ''

                  return (
                    <div key={mealType} className={`flex items-center justify-between rounded-lg bg-neutral-50 px-3 py-2 ${statusStyle}`}>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-ink">
                          {entry.status === 'cooked' ? '✓ ' : entry.status === 'skipped' ? '➜ ' : ''}
                          {MEAL_EMOJI[mealType]} {entry.snapshotTitle}
                        </p>
                        {entry.note && <p className="truncate text-[10px] text-ink/45">{entry.note}</p>}
                      </div>

                      <div className="ml-2 flex shrink-0 items-center gap-1">
                        {entry.recipeId && (
                          <Link
                            href={`/recipes/${encodeURIComponent(entry.recipeId)}`}
                            className="rounded-md bg-white px-2 py-1 text-[10px] font-medium text-brand-deep shadow-sm"
                          >
                            做法
                          </Link>
                        )}
                        {entry.status !== 'cooked' && (
                          <button
                            type="button"
                            onClick={() => void updateEntry(entry, 'cooked')}
                            className="rounded-md bg-green-600 px-2 py-1 text-[10px] font-medium text-white"
                            title="标记已做"
                          >
                            已做
                          </button>
                        )}
                        {entry.status === 'planned' && (
                          <button
                            type="button"
                            onClick={() => void updateEntry(entry, 'skipped')}
                            className="rounded-md bg-white px-2 py-1 text-[10px] font-medium text-amber-600 shadow-sm"
                            title="跳过这顿"
                          >
                            跳过
                          </button>
                        )}
                        {(entry.status === 'cooked' || entry.status === 'skipped') && (
                          <button
                            type="button"
                            onClick={() => void updateEntry(entry, 'replan')}
                            className="rounded-md bg-white px-2 py-1 text-[10px] font-medium text-ink/60 shadow-sm"
                            title="恢复为计划中"
                          >
                            恢复
                          </button>
                        )}
                        {!isPast && (
                          <button
                            type="button"
                            onClick={() => void updateEntry(entry, 'delete')}
                            className="rounded-md px-1 py-1 text-[11px] text-neutral-400 hover:text-red-500"
                            title="删除安排"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </article>
          )
        })}
      </section>

      <footer className="mt-6 text-center text-[11px] leading-5 text-ink/40">
        提示：做完一顿后可以顺手去 <Link href="/logs/new" className="underline">做饭记录</Link> 传照片写复盘
      </footer>

      {pickerTarget && (
        <RecipePickerSheet target={pickerTarget} onClose={() => setPickerTarget(null)} onConfirm={confirmPick} />
      )}
    </main>
  )
}
