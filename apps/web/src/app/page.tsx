'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useAuth } from '@/components/auth-provider'

export default function HomePage() {
  const { user, signOut, getAccessToken } = useAuth()
  const [unreadCount, setUnreadCount] = useState(0)

  // 未读通知数：仅登录用户拉取（进入首页时一次）
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
        const res = await fetch('/api/notifications', { headers: { Authorization: `Bearer ${token}` } })
        const body = (await res.json()) as { unreadCount?: number }
        if (!cancelled) setUnreadCount(body.unreadCount ?? 0)
      } catch {
        // 静默失败，红点保持上一次值
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user, getAccessToken])

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pt-10 pb-12">
      <header className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-brand text-2xl shadow-sm">
            🍚
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">开饭</h1>
            <p className="text-xs text-ink/60">找菜谱 · 记做饭 · 让别人点菜</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {user && (
            <Link
              href="/notifications"
              className="relative rounded-xl bg-white px-2.5 py-1.5 text-base shadow-sm active:scale-95"
              aria-label="消息中心"
            >
              🔔
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex min-w-4.5 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </Link>
          )}
          {user ? (
            <button
              type="button"
              onClick={() => void signOut()}
              className="rounded-xl bg-white px-3 py-1.5 text-xs text-ink/60 shadow-sm active:scale-95"
            >
              退出
            </button>
          ) : (
            <Link
              href="/login"
              className="rounded-xl bg-brand px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm active:scale-95"
            >
              登录
            </Link>
          )}
        </div>
      </header>

      <section className="mb-6 rounded-2xl bg-white p-4 text-xs leading-5 text-ink/75 shadow-sm">
        💡 iPhone 在 Safari 点分享 → <span className="font-bold text-brand">添加到主屏幕</span>，可作为独立 App 全屏使用。
      </section>

      {/* 核心功能模块 */}
      <section className="mb-6 space-y-3">
        <Link
          href="/recipes"
          className="block rounded-2xl bg-white p-4 shadow-sm active:scale-[0.99]"
        >
          <div className="mb-1 flex items-center justify-between">
            <h2 className="font-semibold text-sm">📖 菜谱市场</h2>
            <span className="rounded-full bg-brand-soft px-2 py-0.5 text-xs font-medium text-brand-deep">
              去逛逛
            </span>
          </div>
          <p className="text-xs text-ink/60">搜索、语音提问、查看食材用量与详细步骤</p>
        </Link>

        <Link
          href="/logs"
          className="block rounded-2xl bg-white p-4 shadow-sm active:scale-[0.99]"
        >
          <div className="mb-1 flex items-center justify-between">
            <h2 className="font-semibold text-sm">🍳 做饭记录</h2>
            <span className="rounded-full bg-brand-soft px-2 py-0.5 text-xs font-medium text-brand-deep">
              日志流
            </span>
          </div>
          <p className="text-xs text-ink/60">一顿多菜、拍照上传成品、留下专属复盘心得</p>
        </Link>

        <Link
          href="/stats"
          className="block rounded-2xl bg-white p-4 shadow-sm active:scale-[0.99]"
        >
          <div className="mb-1 flex items-center justify-between">
            <h2 className="font-semibold text-sm">📊 统计看板</h2>
            <span className="rounded-full bg-brand-soft px-2 py-0.5 text-xs font-medium text-brand-deep">
              数据画像
            </span>
          </div>
          <p className="text-xs text-ink/60">做饭顿次/连续天数/最常做的菜 Top10，一键生成分享海报</p>
        </Link>

        <Link
          href="/orders"
          className="block rounded-2xl bg-white p-4 shadow-sm active:scale-[0.99]"
        >
          <div className="mb-1 flex items-center justify-between">
            <h2 className="font-semibold text-sm">📝 点单广场</h2>
            <span className="rounded-full bg-brand-soft px-2 py-0.5 text-xs font-medium text-brand-deep">
              社交点单
            </span>
          </div>
          <p className="text-xs text-ink/60">分享专属链接给家人朋友，免登录点菜，自动生成缺失食材清单</p>
        </Link>

        <Link
          href="/shopping-list"
          className="block rounded-2xl bg-white p-4 shadow-sm active:scale-[0.99]"
        >
          <div className="mb-1 flex items-center justify-between">
            <h2 className="font-semibold text-sm">🛒 购物清单</h2>
            <span className="rounded-full bg-brand-soft px-2 py-0.5 text-xs font-medium text-brand-deep">
              买菜备料
            </span>
          </div>
          <p className="text-xs text-ink/60">一键汇总点单与菜谱缺失食材，买菜即时勾选已备齐</p>
        </Link>
      </section>

      <Link
        href="/voice"
        className="rounded-2xl bg-brand/10 border border-brand/20 px-4 py-3 text-center text-xs font-semibold text-brand active:scale-[0.99]"
      >
        🎙️ 语音搜索测试页
      </Link>

      <footer className="mt-auto pt-8 text-center text-xs text-ink/40">
        开饭 KaiFan · 手机优先的做饭全记录
      </footer>
    </main>
  )
}
