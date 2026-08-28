'use client'

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import type { MealType } from '@kaifan/shared'

import { useAuth } from '@/components/auth-provider'
import { IconCheck, IconChevronRight } from '@/components/icons'
import { EmptyState, LoginRequired, NavBar } from '@/components/ui'

interface CircleSummary {
  id: string
  name: string
  memberCount: number
}

interface DishRow {
  id: string
  snapshot_title: string
  snapshot_cover: string | null
  photos: string[]
  adjust_note: string | null
}

interface CookSessionRow {
  id: string
  date: string
  meal_type: MealType
  rating: number | null
  cook_dishes: DishRow[]
}

interface ShareResponse {
  ok?: boolean
  memory?: { id: string }
  error?: string
}

function formatDate(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })
}

export default function ShareCookSessionPage() {
  const params = useParams<{ sessionId: string }>()
  const router = useRouter()
  const { user, loading: authLoading, getAccessToken } = useAuth()
  const [log, setLog] = useState<CookSessionRow | null>(null)
  const [circles, setCircles] = useState<CircleSummary[]>([])
  const [selectedCircleId, setSelectedCircleId] = useState('')
  const [selectedDishIds, setSelectedDishIds] = useState<string[]>([])
  const [selectedPhotos, setSelectedPhotos] = useState<string[]>([])
  const [sharedNote, setSharedNote] = useState('')
  const [rating, setRating] = useState(0)
  const [loading, setLoading] = useState(true)
  const [publishing, setPublishing] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (authLoading || !user || !params.sessionId) return
    void (async () => {
      try {
        const token = await getAccessToken()
        if (!token) throw new Error('登录状态已失效')
        const [logResponse, circleResult] = await Promise.all([
          fetch(`/api/cook-logs/${params.sessionId}`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch('/api/circles', { headers: { Authorization: `Bearer ${token}` } }),
        ])

        const logBody = (await logResponse.json()) as { log?: CookSessionRow; error?: string }
        if (!logResponse.ok || !logBody.log) throw new Error(logBody.error ?? '做饭记录加载失败')
        const nextLog = logBody.log
        setLog(nextLog)
        setSelectedDishIds((nextLog.cook_dishes ?? []).map((dish) => dish.id))

        const circleBody = (await circleResult.json()) as { circles?: CircleSummary[]; error?: string }
        if (!circleResult.ok || !circleBody.circles) throw new Error(circleBody.error ?? '圈子加载失败')
        setCircles(circleBody.circles)
        setSelectedCircleId(circleBody.circles[0]?.id ?? '')
      } catch (err) {
        setError((err as Error).message)
      } finally {
        setLoading(false)
      }
    })()
  }, [authLoading, getAccessToken, params.sessionId, user])

  const availablePhotos = useMemo(() => {
    if (!log) return []
    const selected = new Set(selectedDishIds)
    const photos = new Map<string, string>()
    for (const dish of log.cook_dishes ?? []) {
      if (!selected.has(dish.id)) continue
      for (const photo of dish.photos ?? []) {
        if (!photos.has(photo)) photos.set(photo, dish.snapshot_title)
      }
    }
    return Array.from(photos, ([url, title]) => ({ url, title }))
  }, [log, selectedDishIds])

  const toggleDish = (dishId: string) => {
    if (selectedDishIds.includes(dishId)) {
      const dish = log?.cook_dishes.find((item) => item.id === dishId)
      const dishPhotos = new Set(dish?.photos ?? [])
      setSelectedDishIds((current) => current.filter((id) => id !== dishId))
      setSelectedPhotos((photos) => photos.filter((photo) => !dishPhotos.has(photo)))
      return
    }
    setSelectedDishIds((current) => [...current, dishId])
  }

  const togglePhoto = (photo: string) => {
    setSelectedPhotos((current) => current.includes(photo) ? current.filter((item) => item !== photo) : [...current, photo].slice(0, 8))
  }

  const publish = async () => {
    if (!log || !selectedCircleId || selectedDishIds.length === 0) return
    setPublishing(true)
    setError('')
    try {
      const token = await getAccessToken()
      if (!token) throw new Error('登录状态已失效')
      const response = await fetch(`/api/circles/${selectedCircleId}/memories/from-cook-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          sourceCookSessionId: log.id,
          selectedDishIds,
          selectedPhotos,
          sharedNote: sharedNote.trim() || null,
          rating: rating || null,
          publish: true,
        }),
      })
      const body = (await response.json()) as ShareResponse
      if (!response.ok || !body.ok || !body.memory) throw new Error(body.error ?? '分享失败')
      router.push(`/circles/${selectedCircleId}/meals/${body.memory.id}`)
    } catch (err) {
      setError((err as Error).message)
      setPublishing(false)
    }
  }

  if (authLoading || loading) return <main className="screen pt-20 text-center text-xs text-ink-3">正在准备分享…</main>
  if (!user) return <LoginRequired glyph="🍳" title="登录后分享做饭记录" description="个人记录默认私密，只有你明确选择的内容才会进入圈子" />

  return (
    <div className="screen pb-8">
      <NavBar title="分享这一顿" back="/logs" backLabel="记录" />
      {error && <p className="mt-3 rounded-xl bg-danger-soft p-3 text-[12px] leading-5 text-danger">{error}</p>}
      {!log ? (
        <div className="card mt-6 p-5 text-center text-[13px] text-danger">{error || '记录不存在'}</div>
      ) : circles.length === 0 ? (
        <EmptyState glyph="👥" title="还没有可分享的圈子" description="先加入或创建一个饭搭子群，再把这一顿留给大家。" action={<Link href="/circles" className="btn-primary">去饭搭子群</Link>} />
      ) : (
        <div className="mt-4 space-y-5">
          <section className="card p-4">
            <p className="text-[12px] font-medium text-tint-deep">{formatDate(log.date)}</p>
            <h1 className="mt-1 text-[20px] font-bold text-ink">分享这一顿到饭搭子群</h1>
            <p className="mt-1.5 text-[12px] leading-5 text-ink-3">先选公开内容，再发布到你选择的圈子。</p>
          </section>

          <section>
            <h2 className="section-label mt-0">分享给哪个圈子</h2>
            <div className="list-group">
              {circles.map((circle, index) => (
                <button
                  key={circle.id}
                  type="button"
                  onClick={() => setSelectedCircleId(circle.id)}
                  className={`flex w-full items-center gap-3 px-4 py-3.5 text-left ${index < circles.length - 1 ? 'border-b border-line' : ''}`}
                >
                  <span className={`flex size-5 items-center justify-center rounded-full border ${selectedCircleId === circle.id ? 'border-tint bg-tint text-white' : 'border-ink-3/40'}`}>
                    {selectedCircleId === circle.id && <IconCheck className="size-3" />}
                  </span>
                  <span className="min-w-0 flex-1"><span className="block text-[14px] font-semibold text-ink">{circle.name}</span><span className="mt-0.5 block text-[11px] text-ink-3">{circle.memberCount} 位成员</span></span>
                  <IconChevronRight className="size-4 text-ink-3/50" />
                </button>
              ))}
            </div>
          </section>

          <section>
            <div className="flex items-baseline justify-between"><h2 className="section-label mt-0">选要分享的菜</h2><span className="text-[11px] text-ink-3">{selectedDishIds.length}/{log.cook_dishes.length}</span></div>
            <div className="list-group">
              {log.cook_dishes.map((dish, index) => {
                const selected = selectedDishIds.includes(dish.id)
                return <button key={dish.id} type="button" onClick={() => toggleDish(dish.id)} className={`flex w-full items-center gap-3 px-4 py-3.5 text-left ${index < log.cook_dishes.length - 1 ? 'border-b border-line' : ''}`}><span className={`flex size-5 shrink-0 items-center justify-center rounded-md border ${selected ? 'border-tint bg-tint text-white' : 'border-ink-3/40'}`}>{selected && <IconCheck className="size-3" />}</span><span className="min-w-0 flex-1"><span className="block text-[14px] font-semibold text-ink">{dish.snapshot_title}</span>{dish.adjust_note && <span className="mt-0.5 block text-[11px] text-ink-3">个人调整不会公开</span>}</span></button>
              })}
            </div>
          </section>

          {availablePhotos.length > 0 && <section><div className="flex items-baseline justify-between"><h2 className="section-label mt-0">选要公开的照片</h2><span className="text-[11px] text-ink-3">{selectedPhotos.length}/8</span></div><div className="grid grid-cols-3 gap-2">{availablePhotos.map((photo) => { const selected = selectedPhotos.includes(photo.url); return <button key={photo.url} type="button" onClick={() => togglePhoto(photo.url)} className={`relative aspect-square overflow-hidden rounded-xl bg-fill ${selected ? 'ring-2 ring-tint ring-offset-2 ring-offset-paper' : ''}`} aria-label={`${selected ? '取消选择' : '选择'}${photo.title}照片`}><img src={photo.url} alt={photo.title} className="size-full object-cover" />{selected && <span className="absolute right-1.5 top-1.5 flex size-5 items-center justify-center rounded-full bg-tint text-white"><IconCheck className="size-3" /></span>}</button> })}</div></section>}

          <section className="card p-4 space-y-3">
            <div><h2 className="text-[14px] font-semibold text-ink">给这顿饭留一句话</h2><p className="mt-1 text-[12px] leading-5 text-ink-3">只会分享这里的内容，个人复盘不会公开。</p></div>
            <textarea value={sharedNote} onChange={(event) => setSharedNote(event.target.value)} maxLength={300} placeholder="如：第一次做这道，大家都说好吃" className="field min-h-20 resize-none text-[13px]" />
            <div><p className="mb-1.5 text-[12px] text-ink-3">要不要留个评分</p><div className="flex gap-1 text-[24px]">{[1, 2, 3, 4, 5].map((star) => <button key={star} type="button" onClick={() => setRating(rating === star ? 0 : star)} aria-label={`${star} 星`}>{star <= rating ? '★' : '☆'}</button>)}</div></div>
          </section>

          <section className="card border border-tint/20 bg-tint-soft p-4"><p className="text-[13px] font-semibold text-tint-deep">发布前预览</p><p className="mt-1.5 text-[12px] leading-5 text-ink-2">圈内成员将看到 {selectedDishIds.length} 道菜、{selectedPhotos.length} 张照片{sharedNote.trim() ? '、这一句分享' : ''}{rating ? '和你的评分' : ''}。未选照片、个人调整和私人复盘不会公开。</p></section>

          <button type="button" onClick={() => void publish()} disabled={publishing || !selectedCircleId || selectedDishIds.length === 0} className="btn-primary">{publishing ? '发布中…' : '发布到饭搭子群'}</button>
        </div>
      )}
    </div>
  )
}
