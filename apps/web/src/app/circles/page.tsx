'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { CIRCLE_MAX_MEMBERS } from '@kaifan/shared'
import { useAuth } from '@/components/auth-provider'
import type { CircleSummary } from '@/app/api/circles/route'

export default function CirclesPage() {
  const { user, loading, getAccessToken } = useAuth()
  const [circles, setCircles] = useState<CircleSummary[]>([])
  const [fetching, setFetching] = useState(true)
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

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
      void loadCircles()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setCreating(false)
    }
  }

  if (loading || fetching) {
    return (
      <main className="mx-auto min-h-dvh w-full max-w-md px-5 pt-10 pb-16 text-center text-xs text-ink/50">
        正在拉取你的饭搭子群…
      </main>
    )
  }

  if (!user) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center px-6 text-center">
        <div className="mb-3 text-4xl">👥</div>
        <h1 className="mb-2 text-xl font-bold">需要先登录</h1>
        <p className="mb-6 text-sm text-ink/60">饭搭子群绑定账号，登录后即可创建或加入</p>
        <Link href="/login" className="rounded-xl bg-brand px-6 py-3 font-semibold text-white shadow-sm">
          前往登录 / 注册
        </Link>
      </main>
    )
  }

  return (
    <main className="mx-auto min-h-dvh w-full max-w-md px-5 pt-10 pb-16">
      <header className="mb-5">
        <Link href="/" className="mb-1 inline-block text-xs text-ink/50">← 返回首页</Link>
        <h1 className="text-xl font-bold">👥 饭搭子群</h1>
        <p className="text-xs text-ink/60">固定小圈子（最多 {CIRCLE_MAX_MEMBERS} 人），圈内发点单、一键通知全员</p>
      </header>

      {/* 建圈表单 */}
      <form onSubmit={handleCreate} className="mb-6 rounded-2xl bg-white p-4 shadow-sm space-y-3">
        <label htmlFor="circle-name" className="block text-xs font-semibold text-ink/70">新建一个饭搭子群</label>
        <div className="flex gap-2">
          <input
            id="circle-name"
            type="text"
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            placeholder="如：家人饭桌、二人食（≤20 字）"
            maxLength={20}
            className="min-w-0 flex-1 rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-brand"
          />
          <button
            type="submit"
            disabled={creating || !newName.trim()}
            className="shrink-0 rounded-lg bg-brand px-4 py-2 text-xs font-semibold text-white shadow-sm disabled:opacity-40 active:scale-95"
          >
            {creating ? '创建中…' : '+ 创建'}
          </button>
        </div>
      </form>

      {error && (
        <p className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">{error}</p>
      )}

      {circles.length === 0 ? (
        <section className="rounded-2xl bg-white p-8 text-center shadow-sm space-y-3">
          <p className="text-4xl">🍽️</p>
          <h2 className="text-sm font-semibold">还没有加入任何圈子</h2>
          <p className="text-xs leading-5 text-ink/50">
            自己建一个「家人饭桌」，然后把邀请链接发给另一半和家人；<br />
            或者点开他们分享的邀请链接直接加入。
          </p>
        </section>
      ) : (
        <section className="space-y-3">
          {circles.map((circle) => (
            <Link
              key={circle.id}
              href={`/circles/${circle.id}`}
              className="flex items-center justify-between rounded-2xl bg-white p-4 shadow-sm active:scale-[0.99]"
            >
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-bold text-sm text-ink">{circle.name}</h2>
                  {circle.myRole === 'owner' && (
                    <span className="rounded-full bg-brand px-2 py-0.5 text-[10px] font-bold text-white">群主</span>
                  )}
                </div>
                <p className="mt-0.5 text-[11px] text-ink/45">{circle.memberCount} 位成员</p>
              </div>
              <span className="text-ink/30">›</span>
            </Link>
          ))}
        </section>
      )}
    </main>
  )
}
