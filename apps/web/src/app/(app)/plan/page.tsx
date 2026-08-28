'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { MEAL_TYPES, MEAL_TYPE_LABELS, startOfWeek, toLocalDateKey, weekDates, type MealType } from '@kaifan/shared'
import { useAuth } from '@/components/auth-provider'
import { IconChevronLeft, IconChevronRight, IconPlus, IconX } from '@/components/icons'
import { LoginRequired, NavBar } from '@/components/ui'
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
  }, [user, getAccessToken, dates, monday])

  useEffect(() => {
    if (loading) return
    if (!user) {
      setFetching(false)
      return
    }
    void loadPlan().finally(() => setFetching(false))
  }, [loading, user, loadPlan])

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
  const isCurrentWeek = mondayOffsetWeeks === 0

  if (loading || fetching) {
    return <main className="screen text-center text-xs text-ink-3 pt-20">正在拉取排餐计划…</main>
  }

  if (!user) {
    return (
      <LoginRequired
        glyph="📅"
        title="需要先登录"
        description="排餐计划与账号绑定，登录后即可规划一周吃什么"
      />
    )
  }

  return (
    <div className="screen">
      <NavBar title="排餐计划" back="/me" backLabel="我的" />

      {/* 周切换 */}
      <div className="mt-3 mb-4 flex items-center justify-between card px-3 py-2">
        <button
          type="button"
          onClick={() => setMondayOffsetWeeks((prev) => prev - 1)}
          className="flex items-center gap-0.5 rounded-lg px-2 py-1 text-[13px] font-medium text-ink-2 active:bg-fill"
        >
          <IconChevronLeft className="size-4" /> 上周
        </button>
        <span className={`text-[14px] font-semibold ${isCurrentWeek ? 'text-tint-deep' : 'text-ink'}`}>
          {isCurrentWeek ? '本周 · ' : ''}{weekRangeLabel}
        </span>
        <button
          type="button"
          onClick={() => setMondayOffsetWeeks((prev) => prev + 1)}
          className="flex items-center gap-0.5 rounded-lg px-2 py-1 text-[13px] font-medium text-ink-2 active:bg-fill"
        >
          下周 <IconChevronRight className="size-4" />
        </button>
      </div>

      {error && <p className="mb-3 card p-3 text-[12px] text-danger bg-danger-soft">{error}</p>}

      {/* 7 天日历卡片 */}
      <div className="space-y-3">
        {dates.map((dateKey, index) => {
          const isToday = dateKey === todayKey
          const isPast = dateKey < todayKey
          return (
            <div
              key={dateKey}
              className={`card p-4 space-y-2.5 ${isToday ? 'ring-1 ring-tint/50' : ''}`}
            >
              <div className="flex items-center justify-between border-b border-line pb-2">
                <div className="flex items-center gap-2">
                  <span className={`text-[15px] font-bold ${isToday ? 'text-tint-deep' : 'text-ink'}`}>
                    周{WEEKDAY_NAMES[index]}
                  </span>
                  <span className="text-[12px] text-ink-3">{dateKey.slice(5)}</span>
                </div>
                {isToday && (
                  <span className="rounded-full bg-tint px-2 py-0.5 text-[10px] font-bold text-white">
                    今天
                  </span>
                )}
              </div>

              <div className="space-y-1.5">
                {(MEAL_TYPES as readonly MealType[]).map((mealType) => {
                  const entry = entries.get(`${dateKey}__${mealType}`)
                  if (!entry) {
                    return isPast ? (
                      <div key={mealType} className="flex items-center justify-between rounded-lg bg-fill/50 px-3 py-2 text-[12px] text-ink-3">
                        <span>{MEAL_EMOJI[mealType]} {MEAL_TYPE_LABELS[mealType]}</span>
                        <span className="text-[11px] opacity-60">已过</span>
                      </div>
                    ) : (
                      <button
                        key={mealType}
                        type="button"
                        onClick={() => setPickerTarget({ planDate: dateKey, mealType })}
                        className="flex w-full items-center justify-between rounded-lg bg-fill/60 px-3 py-2 text-left text-[12px] text-ink-3 transition active:bg-fill"
                      >
                        <span>{MEAL_EMOJI[mealType]} {MEAL_TYPE_LABELS[mealType]}</span>
                        <span className="flex items-center gap-0.5 text-[11px] font-medium text-tint">
                          <IconPlus className="size-3" /> 安排
                        </span>
                      </button>
                    )
                  }

                  const cooked = entry.status === 'cooked'
                  const skipped = entry.status === 'skipped'

                  return (
                    <div
                      key={mealType}
                      className={`flex items-center justify-between rounded-lg p-2.5 text-[13px] ${
                        cooked ? 'bg-success-soft text-success' : skipped ? 'bg-fill text-ink-3 line-through' : 'bg-fill text-ink'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">
                          {cooked ? '✓ ' : skipped ? '➜ ' : ''}
                          {MEAL_EMOJI[mealType]} {entry.snapshotTitle}
                        </p>
                        {entry.note && <p className="truncate text-[11px] text-ink-3">{entry.note}</p>}
                      </div>

                      <div className="ml-2 flex shrink-0 items-center gap-1">
                        {entry.recipeId && (
                          <Link
                            href={`/recipes/${encodeURIComponent(entry.recipeId)}`}
                            className="rounded-md bg-surface px-2 py-0.5 text-[11px] font-medium text-tint-deep"
                          >
                            做法
                          </Link>
                        )}
                        {!cooked && (
                          <button
                            type="button"
                            onClick={() => void updateEntry(entry, 'cooked')}
                            className="rounded-md bg-success px-2 py-0.5 text-[11px] font-medium text-white"
                          >
                            已做
                          </button>
                        )}
                        {entry.status === 'planned' && (
                          <button
                            type="button"
                            onClick={() => void updateEntry(entry, 'skipped')}
                            className="rounded-md bg-surface px-2 py-0.5 text-[11px] font-medium text-caution"
                          >
                            跳过
                          </button>
                        )}
                        {(cooked || skipped) && (
                          <button
                            type="button"
                            onClick={() => void updateEntry(entry, 'replan')}
                            className="rounded-md bg-surface px-2 py-0.5 text-[11px] font-medium text-ink-3"
                          >
                            恢复
                          </button>
                        )}
                        {!isPast && (
                          <button
                            type="button"
                            onClick={() => void updateEntry(entry, 'delete')}
                            className="p-1 text-ink-3 hover:text-danger"
                          >
                            <IconX className="size-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {pickerTarget && (
        <RecipePickerSheet target={pickerTarget} onClose={() => setPickerTarget(null)} onConfirm={confirmPick} />
      )}
    </div>
  )
}
