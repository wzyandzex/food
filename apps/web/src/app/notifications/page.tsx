'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import type { NotificationRow } from '@/types/notifications'
import { NOTIFICATION_TYPE_LABELS } from '@/types/notifications'
import { useAuth } from '@/components/auth-provider'
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

  /** 标记单条为已读 */
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
      // 站内乐观更新失败可接受，下次进入页面会自动同步；错误仍需可见
      console.error('标记已读失败：', err)
    }
  }

  /** 全部标记已读 */
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
      // 忽略网络错误，UI 已乐观更新；错误仍需可见
      console.error('全部已读标记失败：', err)
    } finally {
      setOperating(false)
    }
  }

  /** 清空全部已读 */
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
      // 同上，本地乐观处理；错误仍需可见
      console.error('清空已读通知失败：', err)
    } finally {
      setOperating(false)
    }
  }

  if (loading || fetching) {
    return (
      <main className="mx-auto min-h-dvh w-full max-w-md px-5 pt-10 text-center text-xs text-ink/50">
        正在拉取通知…
      </main>
    )
  }

  if (!user) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center px-6 text-center">
        <div className="text-4xl mb-3">🔔</div>
        <h1 className="mb-2 text-xl font-bold">需要先登录</h1>
        <p className="mb-6 text-sm text-ink/60">通知中心与账号绑定，登录后即可查看点单动态和系统推送</p>
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
          <h1 className="text-xl font-bold">🔔 消息中心</h1>
          <p className="text-xs text-ink/60">{unreadCount > 0 ? `${unreadCount} 条未读` : '所有消息都已读'}</p>
        </div>
        {notifications.length > 0 && (
          <div className="flex gap-2">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => void markAllRead()}
                disabled={operating}
                className="rounded-xl bg-neutral-100 px-3 py-1.5 text-xs font-medium text-ink/70 disabled:opacity-50"
              >
                全部已读
              </button>
            )}
            <button
              type="button"
              onClick={() => void clearReadAll()}
              disabled={operating}
              className="rounded-xl bg-red-50 px-3 py-1.5 text-xs font-medium text-red-500 disabled:opacity-50"
            >
              清空已读
            </button>
          </div>
        )}
      </header>

      {/* Web Push 设置与诊断 */}
      <div className="mb-5">
        <PushManagerCard onSubscribedChange={() => void loadNotifications()} />
      </div>

      {error && (
        <p className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">{error}</p>
      )}

      {/* 通知列表 */}
      {notifications.length === 0 ? (
        <section className="rounded-2xl bg-white p-8 text-center shadow-sm space-y-3">
          <p className="text-4xl">📭</p>
          <h2 className="text-sm font-semibold">还没有收到过消息</h2>
          <p className="text-xs leading-5 text-ink/50">
            当有人向你发起的点单提交菜品、或你参与的点单状态变化时，这里会有通知。
          </p>
        </section>
      ) : (
        <section className="space-y-2">
          {notifications.map((notification) => {
            const isUnread = !notification.read_at
            return (
              <Link
                key={notification.id}
                href={notification.url ?? '/notifications'}
                onClick={() => void markAsRead(notification.id)}
                className={`block rounded-2xl p-4 shadow-sm space-y-1 transition active:scale-[0.99] ${
                  isUnread ? 'bg-white border-l-4 border-brand' : 'bg-neutral-100/70'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-semibold ${isUnread ? 'text-brand-deep' : 'text-ink/50'}`}>
                    {NOTIFICATION_TYPE_LABELS[notification.type] ?? '📣 动态'}
                    {isUnread && <span className="ml-2 inline-block size-2 rounded-full align-middle bg-brand" />}
                  </span>
                  <span className="text-[10px] text-neutral-400">{formatRelativeTime(notification.created_at)}</span>
                </div>

                <p className={`text-sm ${isUnread ? 'font-bold text-ink' : 'text-ink/70'}`}>
                  {notification.title}
                </p>
                {notification.body && (
                  <p className="text-xs leading-5 text-ink/55 line-clamp-2">{notification.body}</p>
                )}
              </Link>
            )
          })}
        </section>
      )}
    </main>
  )
}
