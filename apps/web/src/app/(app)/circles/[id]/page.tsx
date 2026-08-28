'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { CIRCLE_MAX_MEMBERS, type CircleMemberRole } from '@kaifan/shared'
import { useAuth } from '@/components/auth-provider'
import { IconChevronRight } from '@/components/icons'
import { GroupedList, ListRow, LoginRequired, NavBar } from '@/components/ui'

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
    if (!circleId || !confirm('确定解散圈子吗？')) return
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
    return <main className="screen text-center text-xs text-ink-3 pt-20">正在进入圈子…</main>
  }

  if (!user) {
    sessionStorage.setItem('kaifan_redirect_after_login', `/circles/${circleId}`)
    return (
      <LoginRequired
        glyph="👥"
        title="需要先登录"
        description="登录后即可查看圈子详情"
      />
    )
  }

  if (error && !detail) {
    return (
      <div className="screen">
        <NavBar title="圈子详情" back="/circles" backLabel="列表" />
        <div className="card mt-6 p-6 text-center space-y-3">
          <p className="text-xs text-danger">{error}</p>
          <button
            type="button"
            onClick={() => router.replace('/circles')}
            className="btn-primary"
          >
            返回列表
          </button>
        </div>
      </div>
    )
  }

  if (!detail) return null

  const isOwner = detail.myRole === 'owner'
  const isFull = detail.members.length >= CIRCLE_MAX_MEMBERS

  return (
    <div className="screen">
      <NavBar title={detail.circle.name} back="/circles" backLabel="圈子" />

      {/* 成员列表 */}
      <section className="card mt-4 p-4">
        <h2 className="text-[13px] font-medium text-ink-3 mb-2.5">
          成员（{detail.members.length}/{CIRCLE_MAX_MEMBERS}）
        </h2>
        <div className="flex flex-wrap gap-1.5">
          {detail.members.map((member) => (
            <span
              key={member.userId}
              className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[12px] font-medium ${
                member.role === 'owner' ? 'bg-tint-soft text-tint-deep font-semibold' : 'bg-fill text-ink-2'
              }`}
            >
              {member.role === 'owner' && '👑 '}
              {member.nickname}
              {member.isMe && <span className="text-[10px] opacity-60"> (我)</span>}
            </span>
          ))}
        </div>
      </section>

      {/* 邀请链接（群主可见） */}
      {isOwner && (
        <section className="card mt-4 p-4 space-y-2">
          <h2 className="text-[13px] font-medium text-ink-3">
            邀请加入{isFull ? '（已满员）' : ''}
          </h2>
          <p className="text-[12px] leading-5 text-ink-3">
            链接 7 天内有效，发给家人朋友，点开登录即入圈
          </p>
          <button
            type="button"
            onClick={() => void handleGenerateInvite()}
            disabled={invitePending || isFull}
            className="btn-tonal py-2.5 text-[13px]"
          >
            {invitePending ? '生成中…' : inviteUrl ? '重新生成链接' : '生成邀请链接'}
          </button>
          {inviteUrl && (
            <div className="space-y-1 pt-1">
              <p className="break-all rounded-lg bg-fill p-2.5 font-mono text-[11px] text-ink-2 select-all">
                {inviteUrl}
              </p>
              <p className={`text-[11px] ${copied ? 'text-success font-semibold' : 'text-ink-3'}`}>
                {copied ? '✓ 已复制，去微信粘贴给饭搭子吧！' : '点击上方链接区域可全选复制'}
              </p>
            </div>
          )}
        </section>
      )}

      {/* 圈内点单动态 */}
      <section className="mt-4">
        <h2 className="text-[13px] font-medium text-ink-3 px-1 mb-1.5">圈内点单动态</h2>
        {detail.recentOrders.length === 0 ? (
          <div className="card p-6 text-center text-[13px] text-ink-3">
            还没有圈内点单——发一场让大家选菜吧
          </div>
        ) : (
          <div className="list-group">
            {detail.recentOrders.map((order, idx) => {
              const isLast = idx === detail.recentOrders.length - 1
              return (
                <Link
                  key={order.id}
                  href={`/orders/${order.id}`}
                  className={`flex items-center justify-between px-4 py-3 transition-colors active:bg-fill ${
                    isLast ? '' : 'border-b border-line'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-semibold text-ink">{order.title}</p>
                    <p className="mt-0.5 text-[11px] text-ink-3">
                      截止 {new Date(order.deadline).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <span className="ml-2 rounded-md bg-tint-soft px-2 py-0.5 text-[11px] font-medium text-tint-deep">
                    {order.statusLabel}
                  </span>
                </Link>
              )
            })}
          </div>
        )}
      </section>

      {error && <p className="mt-3 card p-3 text-[12px] text-danger bg-danger-soft">{error}</p>}

      {/* 发点单 */}
      <div className="mt-6">
        <button
          type="button"
          onClick={() => {
            sessionStorage.setItem('kaifan_order_circle_id', circleId)
            router.push('/orders/new')
          }}
          className="btn-primary"
        >
          🍲 在本圈发起点单
        </button>
      </div>

      <div className="mt-4 text-center">
        {isOwner ? (
          <button type="button" onClick={() => void handleDisband()} className="text-[12px] text-danger hover:underline">
            解散圈子
          </button>
        ) : (
          <button type="button" onClick={() => void handleLeave()} className="text-[12px] text-danger hover:underline">
            退出圈子
          </button>
        )}
      </div>
    </div>
  )
}
