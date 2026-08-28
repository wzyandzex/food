'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

import { useAuth } from '@/components/auth-provider'
import { IconChevronRight } from '@/components/icons'
import { getBrowserClient, isSupabaseConfigured } from '@/lib/supabase'

interface RecentDish {
  id: string
  title: string
  date: string
}

export function RecentCooks() {
  const { user } = useAuth()
  const [recent, setRecent] = useState<RecentDish[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user || !isSupabaseConfigured()) {
      setLoading(false)
      return
    }

    void getBrowserClient()
      .from('cook_sessions')
      .select('id, date, cook_dishes(snapshot_title)')
      .order('date', { ascending: false })
      .limit(3)
      .then(({ data }) => {
        if (!data) return
        const list: RecentDish[] = []
        for (const session of data as unknown as Array<{ id: string; date: string; cook_dishes?: Array<{ snapshot_title: string }> }>) {
          const firstDish = session.cook_dishes?.[0]?.snapshot_title
          if (firstDish) {
            list.push({ id: session.id, title: firstDish, date: session.date })
          }
        }
        setRecent(list)
      })
      .then(() => setLoading(false), () => setLoading(false))
  }, [user])

  if (!user || loading || recent.length === 0) return null

  return (
    <section className="px-4 pt-5">
      <div className="flex items-center justify-between px-1 mb-2">
        <h2 className="text-[13px] font-medium text-ink-3">最近做过的菜</h2>
        <Link href="/logs" className="text-[12px] text-tint active:opacity-60">
          全部记录
        </Link>
      </div>

      <div className="list-group">
        {recent.map((dish, idx) => {
          const isLast = idx === recent.length - 1
          return (
            <Link
              key={dish.id}
              href="/logs"
              className={`flex items-center justify-between px-4 py-3 transition-colors active:bg-fill ${
                isLast ? '' : 'border-b border-line'
              }`}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-semibold text-ink">{dish.title}</p>
                <p className="mt-0.5 text-[12px] text-ink-3">记录于 {dish.date}</p>
              </div>
              <IconChevronRight className="size-4 text-ink-3/60" />
            </Link>
          )
        })}
      </div>
    </section>
  )
}
