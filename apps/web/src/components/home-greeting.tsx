'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

import { useAuth } from '@/components/auth-provider'
import { IconBell } from '@/components/icons'

function getGreetingTime(hour: number): string {
  if (hour < 6) return '夜深了'
  if (hour < 11) return '早上好'
  if (hour < 14) return '中午好'
  if (hour < 18) return '下午好'
  return '晚上好'
}

export function HomeGreeting() {
  const { user, getAccessToken } = useAuth()
  const [unreadCount, setUnreadCount] = useState(0)
  const [greeting, setGreeting] = useState('今天吃什么')

  useEffect(() => {
    const hour = new Date().getHours()
    setGreeting(getGreetingTime(hour))
  }, [])

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

  const nickname =
    user?.user_metadata?.nickname ||
    (user?.email ? user.email.split('@')[0] : null)

  return (
    <header className="flex items-start justify-between px-5 pt-8 pb-4">
      <div>
        <p className="text-[12px] font-medium tracking-wide text-ink-3">
          {greeting}{nickname ? `，${nickname}` : ''}
        </p>
        <h1 className="mt-1 text-[30px] font-bold tracking-tight text-ink font-serif">
          开饭
        </h1>
      </div>

      <div className="flex items-center gap-2 pt-1">
        {user ? (
          <Link
            href="/notifications"
            className="relative flex size-9 items-center justify-center rounded-full bg-surface text-ink-2 active:opacity-60"
            aria-label="通知中心"
          >
            <IconBell className="size-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex min-w-4 items-center justify-center rounded-full bg-tint px-1 text-[10px] font-bold text-white">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </Link>
        ) : (
          <Link
            href="/login"
            className="rounded-full bg-tint px-3.5 py-1.5 text-[12px] font-semibold text-white active:opacity-70"
          >
            登录
          </Link>
        )}
      </div>
    </header>
  )
}
