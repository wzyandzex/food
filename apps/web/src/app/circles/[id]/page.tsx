'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { CIRCLE_MAX_MEMBERS, type CircleMemberRole } from '@kaifan/shared'
import { useAuth } from '@/components/auth-provider'

interface MemberItem {
  userId: string
  nickname: string
  role: CircleMemberRole
  isMe: boolean
}

interface CircleOrderItem {
  id: string
  title: string
  deadline: string
  statusLabel: string
}

interface CircleDetailPayload {
  circle: { id: string; name: string }
  myRole: 'owner' | 'member'
  members: MemberItem[]
  recentOrders: CircleOrderItem[]
}

export default function CircleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const { user, loading, getAccessToken } = useAuth()
  const [circleId, setCircleId] = useState<string | null>(null)
  const [detail, setDetail] = useState<CircleDetailPayload | null>(null)
  const [fetching, setFetching] = useState(true)
  const [error, setError] = useState('')
  const [inviteUrl, setInviteUrl] = useState('')
  const [invitePending, setInvitePending] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    void params.then(({ id }) => setCircleId(id))
  }, [params])

  const loadDetail = useCallback(async () => {
    if (!user || !circleId) return
    setError('')
    try {
      const token = await getAccessToken()
      if (!token) throw new Error('登录状态已失效')

      const res = await fetch(`/api/circles/${circleId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const body = (await res.json()) as Partial<CircleDetailPayload> & { error?: string }
      if (!res.ok || !body.circle) throw new Error(body.error ?? '加载圈子失败')
      setDetail(body as CircleDetailPayload)
    } catch (err) {
      setError((err as Error).message)
    }
  }, [user, getAccessToken, circleId])

  useEffect(() => {
    if (loading) return
    if (user && circleId) void loadDetail().finally(() => setFetching(false))
    else if (!loading) setFetching(false)
  }, [loading, user, circleId, loadDetail])

  const handleGenerateInvite = async () => {
    if (!circleId) return
    setInvitePending(true)
    try {
      const token = await getAccessToken()
      if (!token) throw new Error('登录状态已失效')

      const res = await fetch(`/api/circles/${circleId}/invite`, { method: 'POST' })
      const body = (await res.json()) as { path?: string; error?: string }
      if (!res.ok || !body.path) throw new Error(body.error ?? '生成邀请失败')

      const url = `${window.location.origin}${body.path}`
      setInviteUrl(url)
      void navigator.clipboard.writeText(url).then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2500)
      }).catch(() => {})
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setInvitePending(false)
    }
  }

  const handleLeave = async () => {
    if (!circleId || !confirm('确定退出这个圈子吗？')) return
    try {
      const token = await getAccessToken()
      if (!token) throw new Error('登录状态已失效')

      const res = await fetch(`/api/circles/${circleId}/leave`, { method: 'POST' })
      const body = (await res.json()) as { ok?: boolean; error?: string }
      if (!res.ok || !body.ok) throw new Error(body.error ?? '退出失败')
      router.push('/circles')
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const handleDisband = async () => {
    if (!circleId || !confirm('确定解散圈子吗？成员和历史点单关联将被清除（点单记录本身保留）。')) return
    try {
      const token = await getAccessToken()
      if (!token) throw new Error('登录状态已失效')

      const res = await fetch(`/api/circles/${circleId}`, { method: 'DELETE' })
      const body = (await res.json()) as { ok?: boolean; error?: string }
      if (!res.ok || !body.ok) throw new Error(body.error ?? '解散失败')
      router.push('/circles')
    } catch (err) {
      setError((err as Error).message)
    }
  }

  if (loading || fetching || !circleId) {
    return (
      <main className="mx-auto min-h-dvh w-full max-w-md px-5 pt-10 pb-16 text-center text-xs text-ink/50">
        正在进入圈子…
      </main>
    )
  }

  if (!user) {
    sessionStorage.setItem('kaifan_redirect_after_login', `/circles/${circleId}`)
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center px-6 text-center">
        <div className="mb-3 text-4xl">👥</div>
        <h1 className="mb-2 text-xl font-bold">需要先登录</h1>
        <p className="mb-6 text-sm text-ink/60">登录后即可查看圈子详情</p>
        <Link href="/login" className="rounded-xl bg-brand px-6 py-3 font-semibold text-white shadow-sm">
          前往登录 / 注册
        </Link>
      </main>
    )
  }

  if (error && !detail) {
    return (
      <main className="mx-auto min-h-dvh w-full max-w-md px-5 pt-10 pb-16">
        <Link href="/circles" className="mb-2 inline-block text-xs text-ink/50">← 返回圈子列表</Link>
        <div className="rounded-2xl bg-white p-8 text-center shadow-sm space-y-3">
          <p className="text-3xl">😅</p>
          <p className="text-xs leading-5 text-red-600">{error}</p>
          <button
            type="button"
            onClick={() => router.replace('/circles')}
            className="rounded-xl bg-brand px-5 py-2.5 text-xs font-semibold text-white shadow-sm"
          >
            返回列表
          </button>
        </div>
      </main>
    )
  }

  if (!detail) return null

  const isOwner = detail.myRole === 'owner'
  const isFull = detail.members.length >= CIRCLE_MAX_MEMBERS

  return (
    <main className="mx-auto min-h-dvh w-full max-w-md px-5 pt-10 pb-16">
      <header className="mb-5">
        <Link href="/circles" className="mb-1 inline-block text-xs text-ink/50">← 返回圈子列表</Link>
        <h1 className="text-xl font-bold">👥 {detail.circle.name}</h1>
        <p className="text-xs text-ink/60">
          {detail.members.length}/{CIRCLE_MAX_MEMBERS} 位成员 · 我{isOwner ? '是群主' : '是成员'}
        </p>
      </header>

      {/* 成员列表 */}
      <section className="mb-4 rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-xs font-bold text-ink/70">成员（{detail.members.length}）</h2>
        <ul className="flex flex-wrap gap-2">
          {detail.members.map((member) => (
            <li
              key={member.userId}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs ${
                member.role === 'owner' ? 'bg-brand-soft text-brand-deep' : 'bg-neutral-100 text-ink/75'
              }`}
            >
              {member.role === 'owner' && <span title="群主">👑</span>}
              <span className="font-medium">{member.nickname}</span>
              {member.isMe && <span className="text-[10px] opacity-60">(我)</span>}
            </li>
          ))}
        </ul>

        {!isFull && !isOwner && (
          <p className="mt-3 text-[11px] leading-4 text-ink/45">
            想拉人进来？请让群主分享邀请链接。
          </p>
        )}
      </section>

      {/* 邀请区块（owner 可见） */}
      {isOwner && (
        <section className="mb-4 rounded-2xl bg-white p-4 shadow-sm space-y-2.5">
          <h2 className="text-xs font-bold text-ink/70">
            🔗 邀请加入{isFull ? `（已满 ${CIRCLE_MAX_MEMBERS} 人）` : ''}
          </h2>
          <p className="text-[11px] leading-4 text-ink/50">
            生成的链接 7 天内有效，发给家人朋友，点开登录即入圈；重复生成会使旧链接失效。
          </p>
          <button
            type="button"
            onClick={() => void handleGenerateInvite()}
            disabled={invitePending || isFull}
            className="w-full rounded-xl bg-brand py-2.5 text-xs font-semibold text-white shadow-sm disabled:opacity-40 active:scale-[0.99]"
          >
            {invitePending ? '生成中…' : inviteUrl ? '重新生成邀请链接' : '生成邀请链接'}
          </button>
          {inviteUrl && (
            <div className="space-y-1.5">
              <p className="break-all rounded-lg bg-neutral-100 p-2.5 font-mono text-[11px] text-ink/70 select-all">
                {inviteUrl}
              </p>
              <p className={`text-[11px] ${copied ? 'text-green-600 font-semibold' : 'text-ink/45'}`}>
                {copied ? '✓ 已复制，去微信粘贴给饭搭子吧！' : '点击上方链接区域可全选复制'}
              </p>
            </div>
          )}
        </section>
      )}

      {/* 圈内点单动态 */}
      <section className="mb-4 rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-xs font-bold text-ink/70">圈内点单动态</h2>
        {detail.recentOrders.length === 0 ? (
          <p className="py-3 text-xs text-ink/40">还没有圈内点单——点下方按钮发起第一场！</p>
        ) : (
          <ul className="space-y-2">
            {detail.recentOrders.map((order) => (
              <li key={order.id}>
                <Link
                  href={`/orders/${order.id}`}
                  className="flex items-center justify-between rounded-xl bg-neutral-50 px-3.5 py-3 active:bg-brand-soft"
                >
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-ink">{order.title}</p>
                    <p className="mt-0.5 text-[10px] text-ink/45">
                      截止 {new Date(order.deadline).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <span className="ml-2 shrink-0 rounded-full bg-white px-2 py-0.5 text-[10px] font-medium text-brand-deep shadow-sm">
                    {order.statusLabel}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {error && (
        <p className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">{error}</p>
      )}

      {/* 主操作：发圈内点单 */}
      <button
        type="button"
        onClick={() => {
          sessionStorage.setItem('kaifan_order_circle_id', circleId)
          router.push('/orders/new')
        }}
        disabled={isFull && false}
        className="w-full rounded-2xl bg-brand py-4 text-center font-semibold text-white shadow-sm active:scale-[0.99]"
      >
        🍲 在本圈发起点单
      </button>

      <div className="mt-6 text-center">
        {isOwner ? (
          <button type="button" onClick={() => void handleDisband()} className="text-[11px] text-red-400 underline">
            解散圈子
          </button>
        ) : (
          <button type="button" onClick={() => void handleLeave()} className="text-[11px] text-red-400 underline">
            退出圈子
          </button>
        )}
      </div>
    </main>
  )
}
