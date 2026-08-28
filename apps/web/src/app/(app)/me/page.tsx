'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

import { useAuth } from '@/components/auth-provider'
import {
  IconBell,
  IconCalendar,
  IconCart,
  IconChart,
  IconClipboard,
  IconFridge,
  IconMic,
  IconUsers,
} from '@/components/icons'
import { GroupedList, ListRow, PageHeader } from '@/components/ui'

export default function MePage() {
  const { user, signOut, getAccessToken } = useAuth()
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    void (async () => {
      try {
        const token = await getAccessToken()
        if (!token) return
        const res = await fetch('/api/notifications', { headers: { Authorization: `Bearer ${token}` } })
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
    <div className="screen">
      <PageHeader title="我的" />

      {/* 用户名片 */}
      <section className="card p-4">
        {user ? (
          <div className="flex items-center gap-3.5">
            <div className="flex size-12 items-center justify-center rounded-full bg-tint-soft text-[20px] font-bold text-tint-deep">
              {user.email?.slice(0, 1).toUpperCase() ?? 'K'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[16px] font-semibold text-ink">
                {user.user_metadata?.nickname || user.email?.split('@')[0] || '美食家'}
              </p>
              <p className="mt-0.5 truncate text-[12px] text-ink-3">{user.email}</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[16px] font-semibold text-ink">未登录</p>
              <p className="mt-0.5 text-[12px] text-ink-3">登录后云端同步记录、发点单、建圈子</p>
            </div>
            <Link
              href="/login"
              className="rounded-full bg-tint px-4 py-1.5 text-[13px] font-semibold text-white transition active:opacity-70"
            >
              登录 / 注册
            </Link>
          </div>
        )}
      </section>

      {/* 厨房工具 */}
      <GroupedList header="厨房工具">
        <ListRow
          icon={<IconFridge className="size-5 text-tint" />}
          title="清冰箱做菜"
          detail="根据现有食材智能推荐能做的菜"
          href="/fridge"
        />
        <ListRow
          icon={<IconCart className="size-5 text-tint" />}
          title="购物清单"
          detail="买菜备料 · 实时勾选"
          href="/shopping-list"
        />
        <ListRow
          icon={<IconCalendar className="size-5 text-tint" />}
          title="排餐计划"
          detail="一周饮食规划，到点照做"
          href="/plan"
          last
        />
      </GroupedList>

      {/* 社交与做饭圈 */}
      <GroupedList header="社交与数据">
        <ListRow
          icon={<IconClipboard className="size-5 text-tint" />}
          title="点单广场"
          detail="发起点单会话，发微信让家人点菜"
          href="/orders"
        />
        <ListRow
          icon={<IconUsers className="size-5 text-tint" />}
          title="饭搭子群"
          detail="2–10 人固定圈子，一键发全员点单"
          href="/circles"
        />
        <ListRow
          icon={<IconChart className="size-5 text-tint" />}
          title="统计看板"
          detail="连续做饭、最常做的菜与做饭月报"
          href="/stats"
        />
        <ListRow
          icon={<IconMic className="size-5 text-tint" />}
          title="语音搜菜"
          detail="按住说话快速搜菜谱"
          href="/voice"
          last
        />
      </GroupedList>

      {/* 消息与设置 */}
      <GroupedList header="系统">
        <ListRow
          icon={<IconBell className="size-5 text-tint" />}
          title="消息中心"
          right={
            unreadCount > 0 ? (
              <span className="rounded-full bg-tint px-1.5 py-0.2 text-[10px] font-bold text-white">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            ) : null
          }
          href="/notifications"
        />
        {user && (
          <ListRow
            title="退出登录"
            danger
            onClick={() => void signOut()}
            last
          />
        )}
      </GroupedList>

      {/* PWA 提示 */}
      <p className="mt-8 px-4 text-center text-[11px] leading-5 text-ink-3">
        💡 在 iPhone Safari 点分享 → <strong>添加到主屏幕</strong>，可作为独立 App 使用。<br />
        开饭 KaiFan · 干净、克制、安静的私人做饭生活记录
      </p>
    </div>
  )
}
