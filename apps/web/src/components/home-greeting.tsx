'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

import { useAuth } from '@/components/auth-provider'
import { IconBell } from '@/components/icons'

const WEEKDAYS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']

function getTimeContext(hour: number): { eyebrow: string; title: string } {
  if (hour < 6) return { eyebrow: '夜深了', title: '今夜想吃点什么' }
  if (hour < 10) return { eyebrow: '早上好', title: '早饭吃什么' }
  if (hour < 14) return { eyebrow: '中午好', title: '午饭吃什么' }
  if (hour < 17) return { eyebrow: '下午好', title: '今晚吃什么' }
  if (hour < 21) return { eyebrow: '晚上好', title: '今晚吃什么' }
  return { eyebrow: '夜深了', title: '夜宵吃什么' }
}

function formatDateEyebrow(date: Date, greeting: string, nickname: string | null): string {
  const month = date.getMonth() + 1
  const day = date.getDate()
  const weekday = WEEKDAYS[date.getDay()]
  const namePart = nickname ? ` · ${nickname}` : ''
  return `${month}月${day}日 ${weekday} · ${greeting}${namePart}`
}

export function HomeGreeting() {
  const { user, getAccessToken } = useAuth()
  const [unreadCount, setUnreadCount] = useState(0)
  const [dateInfo, setDateInfo] = useState<{ eyebrow: string; title: string }>({
    eyebrow: '今天吃什么',
    title: '今天吃什么',
  })

  useEffect(() => {
    const now = new Date()
    const { eyebrow, title } = getTimeContext(now.getHours())

    // 过滤纯数字账号（如纯数字邮箱前缀 2794129678），避免粗糙感
    let displayNick: string | null = user?.user_metadata?.nickname || null
    if (!displayNick && user?.email) {
      const prefix = user.email.split('@')[0] ?? ''
      if (!/^\d+$/.test(prefix)) {
        displayNick = prefix
      }
    }

    setDateInfo({
      eyebrow: formatDateEyebrow(now, eyebrow, displayNick),
      title,
    })
  }, [user])

  useEffect(() => {
    if (!user) {
      setUnreadCount(0)
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const token = await getAccessToken()
        if (!token) return
        const res = await fetch('/api/notifications', {
          headers: { Authorization: `Bearer ${token}` },
        })
        const body = (await res.json()) as { unreadCount?: number }
        if (!cancelled) setUnreadCount(body.unreadCount ?? 0)
      } catch {
        // 静默
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user, getAccessToken])

  return (
    <header className="px-5 pt-7 pb-4">
      {/* 顶部小字日期 + 通知铃铛 */}
      <div className="flex items-center justify-between">
        <p className="text-[12px] font-medium tracking-wide text-ink-3 uppercase">
          {dateInfo.eyebrow}
        </p>

        {user ? (
          <Link
            href="/notifications"
            className="relative -mr-1 flex size-8 items-center justify-center rounded-full text-ink-2 transition active:opacity-60"
            aria-label="通知中心"
          >
            <IconBell className="size-4.5" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 flex min-w-3.5 items-center justify-center rounded-full bg-tint px-1 text-[9px] font-bold text-white">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </Link>
        ) : (
          <Link
            href="/login"
            className="rounded-full bg-fill px-3 py-1 text-[12px] font-medium text-ink-2 active:bg-fill-strong"
          >
            登录
          </Link>
        )}
      </div>

      {/* 真正的主角：大标题（现代无衬线，随时间变化） */}
      <h1 className="mt-1.5 text-[28px] leading-tight font-bold tracking-tight text-ink">
        {dateInfo.title}
      </h1>
    </header>
  )
}
