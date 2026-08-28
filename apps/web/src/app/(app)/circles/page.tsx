'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { CIRCLE_MAX_MEMBERS } from '@kaifan/shared'
import { useAuth } from '@/components/auth-provider'
import type { CircleSummary } from '@/app/api/circles/route'
import { IconChevronRight, IconPlus } from '@/components/icons'
import { EmptyState, GroupedList, ListRow, LoginRequired, NavBar } from '@/components/ui'

export default function CirclesPage() {
  const { user, loading, getAccessToken } = useAuth()
  const [circles, setCircles] = useState<CircleSummary[]>([])
  const [fetching, setFetching] = useState(true)
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [showCreate, setShowCreate] = useState(false)

  const loadCircles = useCallback(async () => {
    if (!user) return
    setError('')
    try {
      const token = await getAccessToken()
      if (!token) throw new Error('登录状态已失效')
      const res = await fetch('/api/circles', { headers: { Authorization: `Bearer ${token}` } })
      const body = (await res.json()) as { circles?: CircleSummary[]; error?: string }
      if (!res.ok || !body.circles) throw new Error(body.error ?? '加载圈子失败')
      setCircles(body.circles)
    } catch (err) {
      setError((err as Error).message)
    }
  }, [user, getAccessToken])

  useEffect(() => {
    if (loading) return
    if (!user) {
      setFetching(false)
      return
    }
    void loadCircles().finally(() => setFetching(false))
  }, [loading, user, loadCircles])

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault()
    const name = newName.trim()
    if (!name) return

    setCreating(true)
    setError('')
    try {
      const token = await getAccessToken()
      if (!token) throw new Error('登录状态已失效')

      const res = await fetch('/api/circles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name }),
      })
      const body = (await res.json()) as { ok?: boolean; error?: string }
      if (!res.ok || !body.ok) throw new Error(body.error ?? '建圈失败')

      setNewName('')
      setShowCreate(false)
      void loadCircles()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setCreating(false)
    }
  }

  if (loading || fetching) {
    return <main className="screen text-center text-xs text-ink-3 pt-20">正在拉取饭搭子群…</main>
  }

  if (!user) {
    return (
      <LoginRequired
        glyph="👥"
        title="需要先登录"
        description="饭搭子群绑定账号，登录后即可创建或加入"
      />
    )
  }

  return (
    <div className="screen">
      <NavBar
        title="饭搭子群"
        back="/me"
        backLabel="我的"
        action={
          <button
            type="button"
            onClick={() => setShowCreate(!showCreate)}
            className="flex items-center gap-1 rounded-full bg-tint px-3 py-1 text-[13px] font-semibold text-white active:opacity-70"
          >
            <IconPlus className="size-3.5" />
            <span>新建</span>
          </button>
        }
      />

      {/* 新建群弹入表单 */}
      {showCreate && (
        <form onSubmit={handleCreate} className="mt-3 card p-4 space-y-2.5">
          <p className="text-[13px] font-semibold text-ink">新建饭搭子群（≤20 字）</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="如：家人饭桌、二人食"
              maxLength={20}
              className="field text-[13px]"
              autoFocus
            />
            <button
              type="submit"
              disabled={creating || !newName.trim()}
              className="btn-primary w-auto px-4 py-2 text-[13px]"
            >
              {creating ? '创建…' : '确认'}
            </button>
          </div>
        </form>
      )}

      {error && <p className="mt-3 card p-3 text-[12px] text-danger bg-danger-soft">{error}</p>}

      {circles.length === 0 ? (
        <EmptyState
          glyph="🍽️"
          title="还没有加入任何圈子"
          description="自己建一个「家人饭桌」发邀请链接给家人，或者点开他们分享的链接加入"
          action={
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="btn-primary"
            >
              创建第一个饭搭子群
            </button>
          }
        />
      ) : (
        <div className="mt-4 list-group">
          {circles.map((circle, idx) => {
            const isLast = idx === circles.length - 1
            return (
              <Link
                key={circle.id}
                href={`/circles/${circle.id}`}
                className={`flex items-center justify-between px-4 py-3.5 transition-colors active:bg-fill ${
                  isLast ? '' : 'border-b border-line'
                }`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-[15px] font-semibold text-ink">{circle.name}</p>
                    {circle.myRole === 'owner' && (
                      <span className="rounded-full bg-tint-soft px-2 py-0.2 text-[10px] font-bold text-tint-deep">
                        群主
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-[12px] text-ink-3">
                    {circle.currentOrderStatus ? '今天有一顿正在进行' : circle.archiveCount > 0 ? `一起收档了 ${circle.archiveCount} 顿` : `${circle.memberCount}/${CIRCLE_MAX_MEMBERS} 位成员`}
                    {circle.latestMealDate && !circle.currentOrderStatus ? ` · 最近 ${circle.latestMealDate}` : ''}
                  </p>
                </div>
                <IconChevronRight className="size-4 text-ink-3/60" />
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
