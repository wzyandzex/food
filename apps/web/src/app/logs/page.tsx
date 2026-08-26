'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { MEAL_TYPE_LABELS, type MealType } from '@kaifan/shared'

import { useAuth } from '@/components/auth-provider'
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

  useEffect(() => {
    if (authLoading) return
    if (!user || !isSupabaseConfigured()) {
      setLoading(false)
      return
    }

    // 走 anon key + 登录态，RLS（cook_sessions_owner）只放行本人记录
    getBrowserClient()
      .from('cook_sessions')
      .select('id, date, meal_type, note, rating, cook_dishes(snapshot_title, photos, adjust_note)')
      .order('date', { ascending: false })
      .limit(30)
      .then(({ data, error }) => {
        if (error) {
          console.error('做饭日志查询失败：', error.message)
          setLoadError('日志加载失败，请稍后重试')
        } else {
          setLogs((data as unknown as CookSessionRow[]) ?? [])
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
          <h1 className="text-xl font-bold">做饭日志</h1>
          <p className="text-xs text-ink/60">回溯每一顿的温度与味道（仅自己可见）</p>
        </div>
        {user && (
          <Link
            href="/logs/new"
            className="rounded-xl bg-brand px-4 py-2 text-xs font-semibold text-white shadow-sm active:scale-95"
          >
            + 记一顿
          </Link>
        )}
      </header>

      {authLoading || loading ? (
        <p className="rounded-2xl bg-white p-8 text-center text-sm text-ink/50 shadow-sm">加载中…</p>
      ) : !user ? (
        <section className="rounded-2xl bg-white p-8 text-center shadow-sm space-y-3">
          <p className="text-3xl">🔒</p>
          <h2 className="text-sm font-semibold">登录后查看你的做饭日志</h2>
          <p className="text-xs text-ink/50 leading-5">做饭记录默认仅自己可见，需要登录身份</p>
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
      ) : logs.length === 0 ? (
        <section className="rounded-2xl bg-white p-8 text-center shadow-sm">
          <p className="text-3xl mb-3">🍳</p>
          <h2 className="text-sm font-semibold mb-1">还没有做饭记录</h2>
          <p className="text-xs text-ink/50 mb-4">今天做了什么好吃的？记下第一顿吧</p>
          <Link
            href="/logs/new"
            className="inline-block rounded-xl bg-brand px-5 py-2.5 text-xs font-semibold text-white shadow-sm"
          >
            开始记录
          </Link>
        </section>
      ) : (
        <section className="space-y-4">
          {logs.map((log) => {
            const mealLabel = MEAL_TYPE_LABELS[log.meal_type as MealType] ?? log.meal_type
            return (
              <article key={log.id} className="rounded-2xl bg-white p-5 shadow-sm space-y-3">
                <div className="flex items-center justify-between border-b border-neutral-100 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm">{log.date}</span>
                    <span className="rounded-full bg-brand-soft px-2 py-0.5 text-xs font-medium text-brand-deep">
                      {mealLabel}
                    </span>
                  </div>
                  {log.rating && (
                    <span className="text-xs text-amber-500">
                      {'⭐'.repeat(log.rating)}
                    </span>
                  )}
                </div>

                {/* 菜品列表 */}
                <div className="space-y-2">
                  {(log.cook_dishes ?? []).map((dish, idx) => (
                    <div key={idx} className="text-xs space-y-1">
                      <div className="font-semibold text-ink/90 flex items-center gap-1.5">
                        <span className="size-1.5 rounded-full bg-brand" />
                        {dish.snapshot_title}
                      </div>
                      {dish.adjust_note && (
                        <p className="text-ink/50 pl-3 italic">
                          💡 复盘：{dish.adjust_note}
                        </p>
                      )}
                      {dish.photos && dish.photos.length > 0 && (
                        <div className="flex gap-2 pl-3 pt-1">
                          {dish.photos.map((p, pIdx) => (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              key={pIdx}
                              src={p}
                              alt="菜品照"
                              className="size-14 rounded-lg object-cover border border-neutral-100"
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {log.note && (
                  <p className="border-t border-neutral-50 pt-2 text-xs text-ink/60 bg-brand-soft/40 -mx-5 -mb-5 p-3 rounded-b-2xl">
                    💭 {log.note}
                  </p>
                )}
              </article>
            )
          })}
        </section>
      )}
    </main>
  )
}
