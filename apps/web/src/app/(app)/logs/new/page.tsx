'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { MEAL_TYPE_LABELS, type MealType } from '@kaifan/shared'

import { useAuth } from '@/components/auth-provider'
import { IconPlus, IconX } from '@/components/icons'
import { LoginRequired, NavBar } from '@/components/ui'
import { getBrowserClient } from '@/lib/supabase'

interface DishDraft {
  title: string
  photos: string[]
  adjustNote: string
  recipeId?: string
}

interface RecipeOption {
  id: string
  title: string
}

interface OrderSessionOption {
  id: string
  title: string
  status: string
}

async function compressImage(file: File): Promise<Blob> {
  if (file.size <= 200 * 1024) return file
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/webp', 0.8),
    )
    return blob && blob.size < file.size ? blob : file
  } catch {
    return file
  }
}

export default function NewCookLogPage() {
  const router = useRouter()
  const { user, loading, getAccessToken } = useAuth()

  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [mealType, setMealType] = useState<MealType>('dinner')
  const [overallRating, setOverallRating] = useState(5)
  const [overallNote, setOverallNote] = useState('')
  const [dishes, setDishes] = useState<DishDraft[]>([
    { title: '', photos: [], adjustNote: '' },
  ])
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [recipeOptions, setRecipeOptions] = useState<RecipeOption[]>([])
  const [orderSessions, setOrderSessions] = useState<OrderSessionOption[]>([])
  const [orderSessionId, setOrderSessionId] = useState('')

  useEffect(() => {
    if (!user) return

    void fetch('/api/recipes/search')
      .then((res) => res.json())
      .then((data: { recipes?: RecipeOption[]; source?: string }) => {
        if (data.source === 'db') setRecipeOptions(data.recipes ?? [])
      })
      .catch(() => {})

    try {
      void getBrowserClient()
        .from('order_sessions')
        .select('id, title, status')
        .in('status', ['open', 'closed', 'cooking'])
        .order('created_at', { ascending: false })
        .limit(20)
        .then(({ data }) => setOrderSessions((data as OrderSessionOption[]) ?? []))
    } catch {
      // 未配置 Supabase
    }
  }, [user])

  const handleAddDish = () => {
    setDishes([...dishes, { title: '', photos: [], adjustNote: '' }])
  }

  const handleRemoveDish = (index: number) => {
    if (dishes.length <= 1) return
    setDishes(dishes.filter((_, i) => i !== index))
  }

  const updateDish = (index: number, patch: Partial<DishDraft>) => {
    setDishes(dishes.map((d, i) => (i === index ? { ...d, ...patch } : d)))
  }

  const handlePhotoUpload = async (index: number, file: File) => {
    setUploadingIndex(index)
    setError('')
    try {
      const token = await getAccessToken()
      if (!token) throw new Error('请先登录后再上传图片')

      const compressed = await compressImage(file)
      const formData = new FormData()
      formData.append('file', compressed, compressed instanceof File ? compressed.name : 'photo.webp')
      const res = await fetch('/api/upload/photo', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })
      const data = (await res.json()) as { url?: string; error?: string }
      if (!res.ok || !data.url) throw new Error(data.error || '上传失败')

      const url = data.url
      setDishes((prev) =>
        prev.map((d, i) => (i === index ? { ...d, photos: [...d.photos, url] } : d)),
      )
    } catch (err) {
      setError(`${(err as Error).message}。已跳过这张照片，可先保存记录稍后补充`)
    } finally {
      setUploadingIndex(null)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) {
      setError('请先登录后再记录')
      return
    }

    const validDishes = dishes.filter((d) => d.title.trim().length > 0)
    if (validDishes.length === 0) {
      setError('请至少填写一道菜名')
      return
    }

    setSubmitting(true)
    setError('')

    try {
      const token = await getAccessToken()
      if (!token) throw new Error('登录状态已失效，请重新登录')

      const res = await fetch('/api/cook-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          date,
          mealType,
          rating: overallRating,
          note: overallNote,
          orderSessionId: orderSessionId || undefined,
          dishes: validDishes.map((d) => ({
            snapshotTitle: d.title.trim(),
            recipeId: d.recipeId,
            photos: d.photos,
            adjustNote: d.adjustNote.trim(),
          })),
        }),
      })

      const data = (await res.json()) as { ok?: boolean; error?: string }
      if (!res.ok || !data.ok) throw new Error(data.error || '保存失败')

      router.push('/logs')
      router.refresh()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <main className="screen text-center text-xs text-ink-3 pt-20">加载中…</main>
  }

  if (!user) {
    return (
      <LoginRequired
        glyph="🍳"
        title="需要先登录"
        description="做饭记录保存在你的个人名下"
      />
    )
  }

  return (
    <div className="screen">
      <NavBar title="记一顿" back="/logs" backLabel="记录" />

      <form onSubmit={handleSubmit} className="mt-4 space-y-5">
        {/* 基础信息卡 */}
        <section className="card p-4 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-[12px] font-medium text-ink-3">日期</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="field text-[13px]"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-[12px] font-medium text-ink-3">餐次</label>
              <select
                value={mealType}
                onChange={(e) => setMealType(e.target.value as MealType)}
                className="field text-[13px]"
              >
                {Object.entries(MEAL_TYPE_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>{label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-[12px] font-medium text-ink-3">这顿整体评价</label>
            <div className="flex gap-2 text-[22px]">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setOverallRating(star)}
                  className="transition active:scale-125"
                >
                  {star <= overallRating ? '★' : '☆'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-[12px] font-medium text-ink-3">总体感想（选填）</label>
            <input
              type="text"
              value={overallNote}
              onChange={(e) => setOverallNote(e.target.value)}
              placeholder="如：今天火候掌握得特别好"
              className="field text-[13px]"
            />
          </div>

          {orderSessions.length > 0 && (
            <div>
              <label className="mb-1 block text-[12px] font-medium text-ink-3">
                关联点单会话（选填）
              </label>
              <select
                value={orderSessionId}
                onChange={(e) => setOrderSessionId(e.target.value)}
                className="field text-[13px]"
              >
                <option value="">不关联</option>
                {orderSessions.map((session) => (
                  <option key={session.id} value={session.id}>
                    {session.title}
                  </option>
                ))}
              </select>
            </div>
          )}
        </section>

        {/* 菜品列表 */}
        <section className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-[13px] font-medium text-ink-3">菜品明细（一顿可多菜）</h2>
            <button
              type="button"
              onClick={handleAddDish}
              className="flex items-center gap-0.5 text-[13px] font-semibold text-tint"
            >
              <IconPlus className="size-3.5" /> 加一道菜
            </button>
          </div>

          {dishes.map((dish, index) => (
            <div key={index} className="card p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-bold text-tint">菜品 #{index + 1}</span>
                {dishes.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveDish(index)}
                    className="p-1 text-ink-3 hover:text-danger"
                  >
                    <IconX className="size-3.5" />
                  </button>
                )}
              </div>

              {recipeOptions.length > 0 && (
                <div>
                  <select
                    value={dish.recipeId ?? ''}
                    onChange={(e) => {
                      const selected = recipeOptions.find((r) => r.id === e.target.value)
                      updateDish(index, {
                        recipeId: selected?.id,
                        title: selected ? selected.title : dish.title,
                      })
                    }}
                    className="field text-[12px]"
                  >
                    <option value="">关联菜谱（选填，自由填菜名也可）</option>
                    {recipeOptions.map((r) => (
                      <option key={r.id} value={r.id}>{r.title}</option>
                    ))}
                  </select>
                </div>
              )}

              <input
                type="text"
                value={dish.title}
                onChange={(e) => updateDish(index, { title: e.target.value })}
                placeholder="菜名（如：西红柿炒鸡蛋）"
                className="field text-[14px] font-semibold"
                required
              />

              <input
                type="text"
                value={dish.adjustNote}
                onChange={(e) => updateDish(index, { adjustNote: e.target.value })}
                placeholder="复盘心得（如：盐略少，下次生抽加半勺）"
                className="field text-[12px]"
              />

              {/* 照片 */}
              <div>
                {dish.photos.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-2">
                    {dish.photos.map((url, pIdx) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={pIdx}
                        src={url}
                        alt="成品照"
                        className="size-16 rounded-lg object-cover bg-fill"
                      />
                    ))}
                  </div>
                )}
                <label className="inline-flex cursor-pointer items-center gap-1 rounded-lg bg-fill px-3 py-1.5 text-[12px] font-medium text-ink-2 transition active:bg-fill-strong">
                  {uploadingIndex === index ? '上传中…' : '📷 拍照 / 选照片'}
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    disabled={uploadingIndex !== null}
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (f) void handlePhotoUpload(index, f)
                    }}
                  />
                </label>
              </div>
            </div>
          ))}
        </section>

        {error && <p className="card p-3 text-[12px] leading-5 text-danger bg-danger-soft">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="btn-primary"
        >
          {submitting ? '保存中…' : '完成，保存这顿记录'}
        </button>
      </form>
    </div>
  )
}
