'use client'

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { MEAL_TYPE_LABELS, type CircleMealAttendee, type CircleMealContribution, type CircleMealMemory, type MealType } from '@kaifan/shared'

import { useAuth } from '@/components/auth-provider'
import { IconChevronLeft, IconPlus } from '@/components/icons'
import { EmptyState, LoginRequired, NavBar } from '@/components/ui'

interface MemoryPayload {
  memory: CircleMealMemory
  attendees: CircleMealAttendee[]
  contributions: CircleMealContribution[]
}

function formatDate(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })
}

export default function CircleMealPage() {
  const params = useParams<{ id: string; memoryId: string }>()
  const router = useRouter()
  const { user, loading: authLoading, getAccessToken } = useAuth()
  const [data, setData] = useState<MemoryPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [note, setNote] = useState('')
  const [rating, setRating] = useState(0)
  const [showContribution, setShowContribution] = useState(false)

  useEffect(() => {
    if (authLoading || !user) return
    void (async () => {
      try {
        const token = await getAccessToken()
        if (!token) throw new Error('登录状态已失效')
        const res = await fetch(`/api/circle-meals/${params.memoryId}`, { headers: { Authorization: `Bearer ${token}` } })
        const body = (await res.json()) as MemoryPayload & { error?: string }
        if (!res.ok || !body.memory) throw new Error(body.error ?? '加载餐桌档案失败')
        setData(body)
      } catch (err) {
        setError((err as Error).message)
      } finally {
        setLoading(false)
      }
    })()
  }, [authLoading, getAccessToken, params.memoryId, user])

  const saveContribution = async () => {
    if (!note.trim() && rating === 0) {
      setError('写一句话或留个评分，再把你的痕迹放进这顿饭')
      return
    }
    setSaving(true)
    setError('')
    try {
      const token = await getAccessToken()
      if (!token) throw new Error('登录状态已失效')
      const res = await fetch(`/api/circle-meals/${params.memoryId}/contributions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ sharedNote: note.trim() || null, rating: rating || null }),
      })
      const body = (await res.json()) as { ok?: boolean; contribution?: CircleMealContribution; error?: string }
      if (!res.ok || !body.ok || !body.contribution) throw new Error(body.error ?? '保存失败')
      const contribution = body.contribution
      setData((prev) => prev ? { ...prev, contributions: [...prev.contributions.filter((item) => item.userId !== contribution.userId), contribution] } : prev)
      setNote('')
      setRating(0)
      setShowContribution(false)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  if (authLoading || loading) return <main className="screen pt-20 text-center text-xs text-ink-3">正在打开这顿饭…</main>
  if (!user) return <LoginRequired glyph="🍚" title="登录后查看餐桌档案" description="这是饭搭子群一起留下的共同记忆" />
  if (!data) return <div className="screen"><NavBar title="餐桌档案" back={`/circles/${params.id}`} backLabel="饭搭子群" /><div className="card mt-6 p-5 text-center text-xs text-danger bg-danger-soft">{error || '档案不存在'}</div></div>

  const { memory, attendees, contributions } = data
  const ownContribution = contributions.find((item) => item.isMe)

  return (
    <div className="screen">
      <NavBar title="餐桌档案" back={`/circles/${params.id}`} backLabel="饭搭子群" />
      {error && <p className="mt-3 rounded-xl bg-danger-soft p-3 text-[12px] leading-5 text-danger">{error}</p>}

      <article className="mt-5 overflow-hidden rounded-2xl bg-surface">
        {memory.coverUrl ? <img src={memory.coverUrl} alt="" className="h-52 w-full object-cover bg-fill" /> : <div className="flex h-36 items-center justify-center bg-tint-soft text-[48px]">🍲</div>}
        <div className="p-5">
          <p className="text-[12px] font-medium text-tint-deep">{formatDate(memory.mealDate)} · {MEAL_TYPE_LABELS[memory.mealType as MealType]}</p>
          <h1 className="mt-1 text-[24px] font-bold leading-8 text-ink">{memory.title}</h1>
          {memory.sharedNote && <p className="mt-3 text-[14px] leading-6 text-ink-2">{memory.sharedNote}</p>}
        </div>
      </article>

      <section className="mt-5">
        <h2 className="section-label mt-0">这顿吃了什么</h2>
        <div className="list-group">{memory.dishes.map((dish, index) => <div key={`${dish.title}-${index}`} className={`flex items-center justify-between px-4 py-3.5 ${index < memory.dishes.length - 1 ? 'border-b border-line' : ''}`}><span className="text-[14px] font-semibold text-ink">{dish.title}</span><span className="text-[12px] text-ink-3">{dish.servings && dish.servings > 1 ? `×${dish.servings}` : '一道'}</span></div>)}</div>
      </section>

      <section className="mt-5">
        <h2 className="section-label mt-0">一起吃的人</h2>
        {attendees.length === 0 ? <div className="card p-4 text-[13px] text-ink-3">还没有标记同席成员</div> : <div className="flex flex-wrap gap-2 px-1">{attendees.map((person) => <span key={person.userId} className="rounded-full bg-fill px-3 py-1.5 text-[12px] font-medium text-ink-2">{person.nickname}{person.isMe ? '（我）' : ''}</span>)}</div>}
      </section>

      <section className="mt-5">
        <div className="flex items-baseline justify-between"><h2 className="section-label mt-0">留下你的这一口</h2><span className="text-[11px] text-ink-3">{contributions.length} 人参与</span></div>
        {contributions.length > 0 && <div className="list-group">{contributions.map((item) => <div key={item.id} className="border-b border-line p-4 last:border-b-0"><div className="flex items-center justify-between"><span className="text-[13px] font-semibold text-ink">{item.nickname}{item.isMe ? '（我）' : ''}</span>{item.rating && <span className="text-[12px] text-tint-deep">{'★'.repeat(item.rating)}</span>}</div>{item.sharedNote && <p className="mt-1.5 text-[13px] leading-5 text-ink-2">{item.sharedNote}</p>}{item.photos.length > 0 && <div className="mt-2 flex gap-2 overflow-x-auto no-scrollbar">{item.photos.map((photo) => <img key={photo} src={photo} alt="成员分享的菜品" className="size-16 shrink-0 rounded-lg object-cover bg-fill" />)}</div>}</div>)}</div>}
        {showContribution ? <div className="card mt-3 p-4 space-y-3"><div><p className="text-[13px] font-semibold text-ink">把你的感受留在这里</p><p className="mt-1 text-[12px] text-ink-3">只分享这一句和评分，不会打开聊天。</p></div><div className="flex gap-1 text-[24px]">{[1, 2, 3, 4, 5].map((star) => <button key={star} type="button" onClick={() => setRating(star)} aria-label={`${star} 星`}>{star <= rating ? '★' : '☆'}</button>)}</div><textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={300} placeholder="如：下次还想吃这道" className="field min-h-24 resize-none text-[13px]" /><div className="flex gap-2"><button type="button" onClick={() => setShowContribution(false)} className="btn-plain py-2.5 text-[13px]">先不写</button><button type="button" onClick={() => void saveContribution()} disabled={saving} className="btn-primary py-2.5 text-[13px]">{saving ? '保存中…' : ownContribution ? '更新我的记录' : '留下这一口'}</button></div></div> : <button type="button" onClick={() => { setNote(ownContribution?.sharedNote ?? ''); setRating(ownContribution?.rating ?? 0); setShowContribution(true) }} className="btn-tonal mt-3 py-2.5 text-[13px]"><IconPlus className="size-4" />{ownContribution ? '编辑我的记录' : '写一句话或打个分'}</button>}
      </section>

      <Link href="/logs/new" className="mt-6 flex items-center justify-center gap-1.5 rounded-xl bg-fill py-3 text-[13px] font-semibold text-ink-2"><IconPlus className="size-4" />再做一次，记下自己的那顿</Link>
    </div>
  )
}
