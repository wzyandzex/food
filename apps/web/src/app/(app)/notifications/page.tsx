'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import type { NotificationRow } from '@/types/notifications'
import { NOTIFICATION_TYPE_LABELS } from '@/types/notifications'
import { useAuth } from '@/components/auth-provider'
import { EmptyState, LoginRequired, NavBar } from '@/components/ui'
import { PushManagerCard } from './push-manager-card'

function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes} 分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} 小时前`
  return `${Math.floor(hours / 24)} 天前`
}

export default function NotificationsPage() {
  const { user, loading, getAccessToken } = useAuth()
  const [notifications, setNotifications] = useState<NotificationRow[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [fetching, setFetching] = useState(true)
  const [error, setError] = useState('')
  const [operating, setOperating] = useState(false)

  const loadNotifications = useCallback(async () => {
    if (!user) return
    setError('')
    try {
      const token = await getAccessToken()
      if (!token) throw new Error('登录状态已失效')

      const res = await fetch('/api/notifications', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const body = (await res.json()) as {
        notifications?: NotificationRow[]
        unreadCount?: number
        error?: string
      }
      if (!res.ok) throw new Error(body.error || '加载通知失败')

      setNotifications(body.notifications ?? [])
      setUnreadCount(body.unreadCount ?? 0)
    } catch (err) {
      setError((err as Error).message)
    }
  }, [user, getAccessToken])

  useEffect(() => {
    if (loading || !user) {
      setFetching(false)
      return
    }
    void loadNotifications().finally(() => setFetching(false))
  }, [loading, user, loadNotifications])

  const markAsRead = async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read_at: n.read_at ?? new Date().toISOString() } : n)),
    )
    setUnreadCount((count) => Math.max(0, count - 1))

    try {
      const token = await getAccessToken()
      if (!token) return
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id }),
      })
    } catch (err) {
      console.error('标记已读失败：', err)
    }
  }

  const markAllRead = async () => {
    setOperating(true)
    setNotifications((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })))
    setUnreadCount(0)
    try {
      const token = await getAccessToken()
      if (token) {
        await fetch('/api/notifications', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ markAllRead: true }),
        })
      }
    } catch (err) {
      console.error('全部已读标记失败：', err)
    } finally {
      setOperating(false)
    }
  }

  const clearReadAll = async () => {
    if (!confirm('确定清空所有已读通知吗？')) return
    setOperating(true)
    setNotifications((prev) => prev.filter((n) => !n.read_at))
    try {
      const token = await getAccessToken()
      if (token) {
        await fetch('/api/notifications', {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        })
      }
    } catch (err) {
      console.error('清空已读通知失败：', err)
    } finally {
      setOperating(false)
    }
  }

  if (loading || fetching) {
    return <main className="screen text-center text-xs text-ink-3 pt-20">正在拉取通知…</main>
  }

  if (!user) {
    return (
      <LoginRequired
        glyph="🔔"
        title="需要先登录"
        description="通知中心与账号绑定，登录后即可查看点单动态和系统推送"
      />
    )
  }

  return (
    <div className="screen">
      <NavBar
        title="消息中心"
        back="/me"
        backLabel="我的"
        action={
          notifications.length > 0 ? (
            <div className="flex items-center gap-1.5">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={() => void markAllRead()}
                  disabled={operating}
                  className="text-[12px] font-medium text-tint"
                >
                  已读
                </button>
              )}
              <button
                type="button"
                onClick={() => void clearReadAll()}
                disabled={operating}
                className="text-[12px] text-ink-3 hover:text-danger"
              >
                清空
              </button>
            </div>
          ) : null
        }
      />

      {/* Push 状态卡片 */}
      <div className="mt-4">
        <PushManagerCard onSubscribedChange={() => void loadNotifications()} />
      </div>

      {error && <p className="mt-3 card p-3 text-[12px] text-danger bg-danger-soft">{error}</p>}

      {notifications.length === 0 ? (
        <EmptyState
          glyph="📭"
          title="还没有收到过消息"
          description="当有人向你发起点单、把一顿饭收进饭搭子群，或点单状态变更时，这里会有通知"
        />
      ) : (
        <div className="mt-4 list-group">
          {notifications.map((notification, idx) => {
            const isUnread = !notification.read_at
            const isLast = idx === notifications.length - 1
            return (
              <Link
                key={notification.id}
                href={notification.url ?? '/notifications'}
                onClick={() => void markAsRead(notification.id)}
                className={`block px-4 py-3.5 transition-colors active:bg-fill ${
                  isLast ? '' : 'border-b border-line'
                } ${isUnread ? 'bg-surface' : 'bg-surface/60'}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    {isUnread && <span className="size-1.5 rounded-full bg-tint" />}
                    <span className={`text-[12px] font-medium ${isUnread ? 'text-tint-deep' : 'text-ink-3'}`}>
                      {NOTIFICATION_TYPE_LABELS[notification.type] ?? '📣 动态'}
                    </span>
                  </div>
                  <span className="text-[11px] text-ink-3">{formatRelativeTime(notification.created_at)}</span>
                </div>

                <p className={`mt-1 text-[14px] ${isUnread ? 'font-semibold text-ink' : 'text-ink-2'}`}>
                  {notification.title}
                </p>
                {notification.body && (
                  <p className="mt-0.5 text-[12px] leading-5 text-ink-3 line-clamp-2">{notification.body}</p>
                )}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
