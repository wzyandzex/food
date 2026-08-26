'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { MEAL_TYPE_LABELS, type MealType } from '@kaifan/shared'

import { useAuth } from '@/components/auth-provider'

interface DishDraft {
  title: string
  photos: string[]
  adjustNote: string
}

export default function NewCookLogPage() {
  const router = useRouter()
  const { user, loading } = useAuth()

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
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/upload/photo', {
        method: 'POST',
        body: formData,
      })
      const data = (await res.json()) as { url?: string; error?: string }
      if (!res.ok || !data.url) {
        throw new Error(data.error || '上传失败')
      }
      const current = dishes[index]
      if (current) {
        updateDish(index, { photos: [...current.photos, data.url] })
      }
    } catch (err) {
      setError((err as Error).message)
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
      const res = await fetch('/api/cook-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          date,
          mealType,
          rating: overallRating,
          note: overallNote,
          dishes: validDishes.map((d) => ({
            snapshotTitle: d.title.trim(),
            photos: d.photos,
            adjustNote: d.adjustNote.trim(),
          })),
        }),
      })

      const data = (await res.json()) as { ok?: boolean; error?: string }
      if (!res.ok || !data.ok) {
        throw new Error(data.error || '保存失败')
      }

      router.push('/logs')
      router.refresh()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <main className="p-8 text-center text-sm text-ink/50">加载中…</main>
  }

  if (!user) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center px-6 text-center">
        <h1 className="mb-2 text-xl font-bold">需要先登录</h1>
        <p className="mb-6 text-sm text-ink/60">做饭记录保存在你的个人档案中</p>
        <Link
          href="/login"
          className="rounded-xl bg-brand px-6 py-3 font-semibold text-white shadow-sm"
        >
          前往登录 / 注册
        </Link>
      </main>
    )
  }

  return (
    <main className="mx-auto min-h-dvh w-full max-w-md px-5 pt-10 pb-16">
      <header className="mb-6">
        <Link href="/logs" className="mb-2 inline-block text-sm text-ink/50">
          ← 返回做饭日志
        </Link>
        <h1 className="text-xl font-bold">记一顿饭</h1>
        <p className="text-sm text-ink/60">一顿多菜 · 上传成品图 · 留句复盘</p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* 基础信息卡片 */}
        <section className="rounded-2xl bg-white p-5 shadow-sm space-y-4">
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="mb-1 block text-xs font-semibold text-ink/60">日期</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                required
              />
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-xs font-semibold text-ink/60">餐次</label>
              <select
                value={mealType}
                onChange={(e) => setMealType(e.target.value as MealType)}
                className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm bg-white"
              >
                {Object.entries(MEAL_TYPE_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>{label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-ink/60">这顿整体评价</label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setOverallRating(star)}
                  className="text-2xl"
                >
                  {star <= overallRating ? '⭐' : '☆'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-ink/60">总体感想（选填）</label>
            <input
              type="text"
              value={overallNote}
              onChange={(e) => setOverallNote(e.target.value)}
              placeholder="如：今天火候掌握得特别好"
              className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
            />
          </div>
        </section>

        {/* 菜品列表 */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-ink/80">菜品明细（一顿可多菜）</h2>
            <button
              type="button"
              onClick={handleAddDish}
              className="text-xs font-semibold text-brand"
            >
              + 加一道菜
            </button>
          </div>

          {dishes.map((dish, index) => (
            <div key={index} className="relative rounded-2xl bg-white p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-brand">菜品 #{index + 1}</span>
                {dishes.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveDish(index)}
                    className="text-xs text-red-500"
                  >
                    删除
                  </button>
                )}
              </div>

              <div>
                <input
                  type="text"
                  value={dish.title}
                  onChange={(e) => updateDish(index, { title: e.target.value })}
                  placeholder="菜名（如：西红柿炒鸡蛋）"
                  className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm font-medium"
                  required
                />
              </div>

              <div>
                <input
                  type="text"
                  value={dish.adjustNote}
                  onChange={(e) => updateDish(index, { adjustNote: e.target.value })}
                  placeholder="复盘心得（如：盐略少，下次生抽加半勺）"
                  className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-xs"
                />
              </div>

              {/* 照片上传与缩略 */}
              <div>
                <div className="mb-2 flex flex-wrap gap-2">
                  {dish.photos.map((url, pIdx) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={pIdx}
                      src={url}
                      alt="成品照"
                      className="size-16 rounded-lg object-cover border border-neutral-200"
                    />
                  ))}
                </div>
                <label className="inline-block cursor-pointer rounded-lg bg-neutral-100 px-3 py-1.5 text-xs font-medium text-ink/70 active:bg-neutral-200">
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

        {error && (
          <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-2xl bg-brand py-4 text-center font-semibold text-white shadow-sm disabled:opacity-50"
        >
          {submitting ? '保存中…' : '完成，保存这顿做饭记录'}
        </button>
      </form>
    </main>
  )
}
