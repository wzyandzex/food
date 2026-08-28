'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { CIRCLE_MAX_MEMBERS, MEAL_TYPE_LABELS, type CircleMealSummary, type CircleMemberRole, type MealType, type OrderSessionStatus } from '@kaifan/shared'

import { useAuth } from '@/components/auth-provider'
import { IconChevronRight, IconClock, IconPlus, IconUsers } from '@/components/icons'
import { EmptyState, LoginRequired, NavBar, Segmented } from '@/components/ui'

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
  status: OrderSessionStatus
  statusLabel: string
  participantCount: number
  createdAt: string
}

interface CircleHomePayload {
  circle: { id: string; name: string; ownerId: string }
  myRole: CircleMemberRole
  currentOrder: CircleOrderItem | null
  latestCompletedOrder: CircleOrderItem | null
  recentOrders: CircleOrderItem[]
  memories: CircleMealSummary[]
  members: MemberItem[]
}

const TABS = [
  { value: 'today' as const, label: '今天' },
  { value: 'archive' as const, label: '餐桌档案' },
  { value: 'members' as const, label: '成员' },
]

function formatDate(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })
}

function formatDeadline(value: string) {
  return new Date(value).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function CircleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const { user, loading, getAccessToken } = useAuth()
  const [circleId, setCircleId] = useState<string | null>(null)
  const [data, setData] = useState<CircleHomePayload | null>(null)
  const [tab, setTab] = useState<'today' | 'archive' | 'members'>('today')
  const [fetching, setFetching] = useState(true)
  const [error, setError] = useState('')
  const [inviteUrl, setInviteUrl] = useState('')
  const [invitePending, setInvitePending] = useState(false)
  const [copied, setCopied] = useState(false)
  const [publishingId, setPublishingId] = useState<string | null>(null)

  useEffect(() => {
    void params.then(({ id }) => setCircleId(id))
  }, [params])

  const loadHome = useCallback(async () => {
    if (!user || !circleId) return
    setError('')
    try {
      const token = await getAccessToken()
      if (!token) throw new Error('登录状态已失效')
      const res = await fetch(`/api/circles/${circleId}/home`, { headers: { Authorization: `Bearer ${token}` } })
      const body = (await res.json()) as CircleHomePayload & { error?: string }
      if (!res.ok || !body.circle) throw new Error(body.error ?? '加载圈子失败')
      setData(body)
    } catch (err) {
      setError((err as Error).message)
    }
  }, [circleId, getAccessToken, user])

  useEffect(() => {
    if (loading) return
    if (user && circleId) void loadHome().finally(() => setFetching(false))
    else if (!loading) setFetching(false)
  }, [circleId, loadHome, loading, user])

  const createOrder = () => {
    if (!circleId) return
    sessionStorage.setItem('kaifan_order_circle_id', circleId)
    router.push('/orders/new')
  }

  const generateInvite = async () => {
    if (!circleId) return
    setInvitePending(true)
    try {
      const token = await getAccessToken()
      if (!token) throw new Error('登录状态已失效')
      const res = await fetch(`/api/circles/${circleId}/invite`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
      const body = (await res.json()) as { path?: string; error?: string }
      if (!res.ok || !body.path) throw new Error(body.error ?? '生成邀请失败')
      const url = `${window.location.origin}${body.path}`
      setInviteUrl(url)
      await navigator.clipboard?.writeText(url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2500)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setInvitePending(false)
    }
  }

  const publishDraft = async (memoryId: string) => {
    setPublishingId(memoryId)
    try {
      const token = await getAccessToken()
      if (!token) throw new Error('登录状态已失效')
      const res = await fetch(`/api/circle-meals/${memoryId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: 'published' }),
      })
      const body = (await res.json()) as { ok?: boolean; error?: string }
      if (!res.ok || !body.ok) throw new Error(body.error ?? '发布失败')
      await loadHome()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setPublishingId(null)
    }
  }

  const publishedMemories = useMemo(() => data?.memories.filter((memory) => memory.status === 'published') ?? [], [data?.memories])
  const drafts = useMemo(() => data?.memories.filter((memory) => memory.status === 'draft') ?? [], [data?.memories])

  if (loading || fetching || !circleId) return <main className="screen pt-20 text-center text-xs text-ink-3">正在进入饭搭子群…</main>
  if (!user) {
    sessionStorage.setItem('kaifan_redirect_after_login', `/circles/${circleId}`)
    return <LoginRequired glyph="👥" title="需要先登录" description="登录后一起决定吃什么，也能留下共同的餐桌档案" />
  }
  if (!data) {
    return <div className="screen"><NavBar title="饭搭子群" back="/circles" backLabel="列表" /><div className="card mt-6 p-5 text-center text-xs text-danger bg-danger-soft">{error || '圈子加载失败'}</div></div>
  }

  const { circle, currentOrder, latestCompletedOrder, members } = data
  const isOwner = data.myRole === 'owner'
  const isFull = members.length >= CIRCLE_MAX_MEMBERS
  const stepStatuses: OrderSessionStatus[] = ['open', 'closed', 'shopping', 'cooking', 'done']
  const activeStep = currentOrder ? Math.max(0, stepStatuses.indexOf(currentOrder.status)) : -1

  return (
    <div className="screen">
      <NavBar title={circle.name} back="/circles" backLabel="饭搭子群" action={<span className="flex size-8 items-center justify-center rounded-full bg-fill text-ink-2"><IconUsers className="size-4" /></span>} />

      <div className="mt-3">
        <Segmented options={TABS} value={tab} onChange={setTab} />
      </div>

      {error && <p className="mt-3 rounded-xl bg-danger-soft p-3 text-[12px] leading-5 text-danger">{error}</p>}

      {tab === 'today' && (
        <div className="mt-5 space-y-5">
          <section className="rounded-2xl bg-ink p-5 text-paper">
            <p className="text-[12px] font-medium text-paper/60">今天的餐桌</p>
            <h1 className="mt-1 text-[24px] font-bold leading-8">{currentOrder ? currentOrder.title : '今晚还没决定吃什么'}</h1>
            <p className="mt-2 text-[13px] leading-5 text-paper/70">
              {currentOrder ? `${currentOrder.participantCount} 位饭搭子已参与` : '从一场点单开始，让大家一起选'}
            </p>
            {currentOrder && (
              <>
                <div className="mt-5 flex items-center gap-1.5">
                  {stepStatuses.map((step, index) => (
                    <span key={step} className={`h-1.5 flex-1 rounded-full ${index <= activeStep ? 'bg-tint' : 'bg-paper/20'}`} />
                  ))}
                </div>
                <div className="mt-2 flex justify-between text-[10px] text-paper/55"><span>选菜</span><span>准备</span><span>开做</span><span>吃完</span></div>
              </>
            )}
          </section>

          {currentOrder ? (
            <section className="card p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2"><IconClock className="size-4 text-tint" /><span className="text-[13px] font-semibold text-ink">{currentOrder.statusLabel}</span></div>
                <span className="text-[12px] text-ink-3">截止 {formatDeadline(currentOrder.deadline)}</span>
              </div>
              <Link href={`/orders/${currentOrder.id}`} className="mt-3 flex items-center justify-between rounded-xl bg-fill px-3.5 py-3 text-[13px] font-semibold text-ink">
                查看这顿汇总 <IconChevronRight className="size-4 text-ink-3" />
              </Link>
            </section>
          ) : latestCompletedOrder ? (
            <section className="card p-4">
              <p className="text-[13px] font-semibold text-ink">上一顿刚刚完成</p>
              <p className="mt-1 text-[12px] text-ink-2">把「{latestCompletedOrder.title}」收进餐桌档案，留住这顿饭。</p>
              <button type="button" onClick={() => void (async () => {
                const token = await getAccessToken()
                if (!token) return
                const res = await fetch(`/api/circles/${circle.id}/memories/from-order`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ sourceOrderSessionId: latestCompletedOrder.id, publish: true, attendeeIds: [] }) })
                const body = (await res.json()) as { memory?: { id: string }; error?: string }
                if (!res.ok || !body.memory) { setError(body.error ?? '收档失败'); return }
                const memoryId = body.memory.id
                if (memoryId) router.push(`/circles/${circle.id}/meals/${memoryId}`)
              })()} className="btn-primary mt-4 py-2.5 text-[13px]">收进餐桌档案</button>
            </section>
          ) : (
            <button type="button" onClick={createOrder} className="btn-primary"><IconPlus className="size-4" />发起今晚点单</button>
          )}

          <section>
            <h2 className="section-label mt-0">最近的餐桌</h2>
            {publishedMemories.length === 0 ? <div className="card p-5 text-center text-[13px] leading-5 text-ink-3">这里还没有共同记忆，饭后把这顿留在这里。</div> : <div className="list-group">{publishedMemories.slice(0, 3).map((memory, index) => <Link key={memory.id} href={`/circles/${circle.id}/meals/${memory.id}`} className={`flex items-center justify-between px-4 py-3.5 ${index < Math.min(publishedMemories.length, 3) - 1 ? 'border-b border-line' : ''}`}><div><p className="text-[14px] font-semibold text-ink">{memory.title}</p><p className="mt-0.5 text-[12px] text-ink-3">{formatDate(memory.mealDate)} · {memory.dishCount} 道菜</p></div><IconChevronRight className="size-4 text-ink-3/60" /></Link>)}</div>}
          </section>
        </div>
      )}

      {tab === 'archive' && (
        <section className="mt-5">
          <div className="mb-3 flex items-baseline justify-between px-1"><div><h1 className="text-[20px] font-bold text-ink">餐桌档案</h1><p className="mt-1 text-[12px] text-ink-3">一起吃过的，都会留在这里</p></div><span className="text-[12px] text-ink-3">{publishedMemories.length} 顿</span></div>
          {drafts.length > 0 && <div className="mb-5 space-y-2"><p className="section-label mt-0">只对你可见</p>{drafts.map((memory) => <div key={memory.id} className="card flex items-center justify-between p-4"><div><p className="text-[14px] font-semibold text-ink">{memory.title}</p><p className="mt-1 text-[12px] text-ink-3">还在整理中 · {memory.dishCount} 道菜</p></div><button type="button" onClick={() => void publishDraft(memory.id)} disabled={publishingId === memory.id} className="rounded-lg bg-tint-soft px-3 py-2 text-[12px] font-semibold text-tint-deep">{publishingId === memory.id ? '发布中…' : '发布'}</button></div>)}</div>}
          {publishedMemories.length === 0 ? <EmptyState glyph="🍚" title="这里还没有共同记忆" description="从一顿点单开始，饭后把它收进餐桌档案。" action={<button type="button" onClick={createOrder} className="btn-primary">发起一顿点单</button>} /> : <div className="space-y-5">{publishedMemories.map((memory, index) => <Link key={memory.id} href={`/circles/${circle.id}/meals/${memory.id}`} className="block"><p className="mb-1 px-1 text-[12px] font-medium text-ink-3">{formatDate(memory.mealDate)} · {MEAL_TYPE_LABELS[memory.mealType as MealType]}</p><article className="card overflow-hidden">{memory.coverUrl ? <img src={memory.coverUrl} alt="" className="h-40 w-full object-cover bg-fill" /> : <div className="flex h-24 items-center justify-center bg-tint-soft text-[32px]">🍲</div>}<div className="flex items-center justify-between p-4"><div><h2 className="text-[16px] font-bold text-ink">{memory.title}</h2><p className="mt-1 text-[12px] text-ink-3">{memory.dishCount} 道菜 · {memory.attendeeCount} 位同席 · {memory.contributionCount} 位留下了痕迹</p></div><IconChevronRight className="size-4 text-ink-3/60" /></div></article></Link>)}</div>}
        </section>
      )}

      {tab === 'members' && (
        <section className="mt-5 space-y-5">
          <div><h1 className="text-[20px] font-bold text-ink">成员</h1><p className="mt-1 text-[12px] text-ink-3">固定的小圈子，最多 {CIRCLE_MAX_MEMBERS} 人</p></div>
          <div className="list-group">{members.map((member, index) => <div key={member.userId} className={`flex items-center gap-3 px-4 py-3.5 ${index < members.length - 1 ? 'border-b border-line' : ''}`}><div className={`flex size-9 items-center justify-center rounded-full text-[13px] font-bold ${member.role === 'owner' ? 'bg-tint-soft text-tint-deep' : 'bg-fill text-ink-2'}`}>{member.nickname.slice(0, 1)}</div><div className="min-w-0 flex-1"><p className="text-[14px] font-semibold text-ink">{member.nickname}{member.isMe && <span className="ml-1 text-[11px] font-normal text-ink-3">（我）</span>}</p><p className="mt-0.5 text-[11px] text-ink-3">{member.role === 'owner' ? '群主' : '饭搭子'}</p></div></div>)}</div>
          {isOwner && <section className="card p-4"><h2 className="text-[14px] font-semibold text-ink">邀请新成员 {isFull && <span className="text-danger">（已满员）</span>}</h2><p className="mt-1 text-[12px] leading-5 text-ink-3">邀请链接 7 天内有效，发给家人朋友，登录后即可加入。</p><button type="button" onClick={() => void generateInvite()} disabled={invitePending || isFull} className="btn-tonal mt-3 py-2.5 text-[13px]">{invitePending ? '生成中…' : inviteUrl ? '重新生成链接' : '生成邀请链接'}</button>{inviteUrl && <><p className="mt-2 break-all rounded-lg bg-fill p-2.5 font-mono text-[11px] text-ink-2 select-all">{inviteUrl}</p><p className="mt-1 text-[11px] font-semibold text-success">{copied ? '已复制，去微信粘贴给饭搭子吧' : '点击链接区域可全选复制'}</p></>}</section>}
          <div className="text-center">{isOwner ? <button type="button" onClick={() => void (async () => { if (!confirm('确定解散这个圈子吗？')) return; const token = await getAccessToken(); if (!token) return; const res = await fetch(`/api/circles/${circle.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }); if (res.ok) router.push('/circles'); else setError('解散失败，请稍后重试') })()} className="text-[12px] text-danger">解散圈子</button> : <button type="button" onClick={() => void (async () => { if (!confirm('确定退出这个圈子吗？')) return; const token = await getAccessToken(); if (!token) return; const res = await fetch(`/api/circles/${circle.id}/leave`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } }); if (res.ok) router.push('/circles'); else setError('退出失败，请稍后重试') })()} className="text-[12px] text-danger">退出圈子</button>}</div>
        </section>
      )}
    </div>
  )
}
