'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { SAMPLE_RECIPES, type RecipeV1 } from '@kaifan/shared'
import { useAuth } from '@/components/auth-provider'

interface RecipeOption {
  id: string
  title: string
  minutes: number
  difficulty: number
}

export default function NewOrderPage() {
  const router = useRouter()
  const { user, loading, getAccessToken } = useAuth()

  const [title, setTitle] = useState('今晚想吃什么？大家来点！')
  const [deadlineTime, setDeadlineTime] = useState('18:00')
  const [perPersonLimit, setPerPersonLimit] = useState(3)
  const [allowFreeInput, setAllowFreeInput] = useState(true)
  const [availableRecipes, setAvailableRecipes] = useState<RecipeOption[]>([])
  const [selectedRecipeIds, setSelectedRecipeIds] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [createdToken, setCreatedToken] = useState<string | null>(null)
  const [error, setError] = useState('')
  // true = 菜谱来自本地样例（未配置数据库），其 id 是菜名而非 UUID，不得提交入库
  const [usingSampleRecipes, setUsingSampleRecipes] = useState(false)

  useEffect(() => {
    // 载入可选菜谱：source=sample 表示服务端数据源未配置，仅作界面演示
    fetch('/api/recipes/search')
      .then((res) => res.json())
      .then((data: { recipes?: RecipeOption[]; source?: string }) => {
        const isSample = data.source === 'sample'
        setUsingSampleRecipes(isSample)
        if (data.recipes && data.recipes.length > 0) {
          setAvailableRecipes(data.recipes)
          setSelectedRecipeIds(data.recipes.map((r) => r.id))
        } else {
          const fallback = SAMPLE_RECIPES.map((r: RecipeV1) => ({
            id: r.title,
            title: r.title,
            minutes: r.minutes,
            difficulty: r.difficulty,
          }))
          setAvailableRecipes(fallback)
          setSelectedRecipeIds(fallback.map((r) => r.id))
        }
      })
      .catch(() => {
        setUsingSampleRecipes(true)
      })
  }, [])

  const toggleRecipe = (id: string) => {
    setSelectedRecipeIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) {
      setError('请先登录后再发起点单')
      return
    }

    setSubmitting(true)
    setError('')

    try {
      const token = await getAccessToken()
      if (!token) throw new Error('登录状态已失效，请重新登录')

      const today = new Date().toISOString().slice(0, 10)
      const deadlineIso = new Date(`${today}T${deadlineTime}:00`).toISOString()

      const res = await fetch('/api/orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          title: title.trim(),
          deadline: deadlineIso,
          perPersonLimit,
          allowFreeInput,
          // 样例菜谱的 id 是菜名不是 UUID：演示模式下不上传候选，避免写库必报错
          candidateRecipeIds: usingSampleRecipes ? [] : selectedRecipeIds,
        }),
      })

      const data = (await res.json()) as { ok?: boolean; token?: string; error?: string }
      if (!res.ok || !data.ok || !data.token) {
        throw new Error(data.error || '创建点单失败')
      }

      setCreatedToken(data.token)
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
        <p className="mb-6 text-sm text-ink/60">发起点单需绑定发起人身份</p>
        <Link
          href="/login"
          className="rounded-xl bg-brand px-6 py-3 font-semibold text-white shadow-sm"
        >
          前往登录 / 注册
        </Link>
      </main>
    )
  }

  if (createdToken) {
    const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/o/${createdToken}` : `/o/${createdToken}`

    return (
      <main className="mx-auto min-h-dvh w-full max-w-md px-5 pt-10 pb-16">
        <section className="rounded-2xl bg-white p-6 text-center shadow-sm space-y-4">
          <div className="text-4xl">🚀</div>
          <h1 className="text-lg font-bold">点单已发起！</h1>
          <p className="text-xs text-ink/60 leading-5">
            把下面的链接发送给微信好友或群聊，对方点击即可免登录选菜。
          </p>

          <div className="rounded-xl bg-neutral-100 p-3 text-xs font-mono break-all text-ink/80 select-all">
            {shareUrl}
          </div>

          <button
            type="button"
            onClick={() => {
              if (navigator.clipboard) {
                void navigator.clipboard.writeText(shareUrl)
                alert('已复制点单链接！去微信粘贴给好友吧')
              }
            }}
            className="w-full rounded-xl bg-brand py-3.5 text-xs font-semibold text-white shadow-sm"
          >
            📋 一键复制分享链接
          </button>

          <div className="flex gap-2 pt-2">
            <Link
              href={`/orders`}
              className="flex-1 rounded-xl bg-neutral-100 py-3 text-xs font-medium text-ink/70"
            >
              返回点单中心
            </Link>
            <Link
              href={`/o/${createdToken}`}
              className="flex-1 rounded-xl bg-brand-soft py-3 text-xs font-medium text-brand-deep"
            >
              预览点单页
            </Link>
          </div>
        </section>
      </main>
    )
  }

  return (
    <main className="mx-auto min-h-dvh w-full max-w-md px-5 pt-10 pb-16">
      <header className="mb-6">
        <Link href="/orders" className="mb-2 inline-block text-xs text-ink/50">
          ← 返回点单广场
        </Link>
        <h1 className="text-xl font-bold">发起一次点单</h1>
        <p className="text-xs text-ink/60">挑选候选菜谱，生成免登录分享链接</p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* 演示模式提示：未配置数据库时菜谱来自本地样例 */}
        {usingSampleRecipes && (
          <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800">
            演示模式：尚未配置菜谱数据库，下方为内置样例菜单（不会写入点单候选）。配置 Supabase 后将自动加载真实菜谱。
          </p>
        )}

        {/* 设置信息 */}
        <section className="rounded-2xl bg-white p-5 shadow-sm space-y-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-ink/70">点单标题</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm font-medium"
              required
            />
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="mb-1 block text-xs font-semibold text-ink/70">今日截止时间</label>
              <input
                type="time"
                value={deadlineTime}
                onChange={(e) => setDeadlineTime(e.target.value)}
                className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                required
              />
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-xs font-semibold text-ink/70">每人最多点(道)</label>
              <input
                type="number"
                min="1"
                max="10"
                value={perPersonLimit}
                onChange={(e) => setPerPersonLimit(Number(e.target.value) || 3)}
                className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                required
              />
            </div>
          </div>

          <label className="flex items-center gap-2 pt-1 text-xs text-ink/80 cursor-pointer">
            <input
              type="checkbox"
              checked={allowFreeInput}
              onChange={(e) => setAllowFreeInput(e.target.checked)}
              className="rounded"
            />
            允许对方自由报菜名（库里没有的也可以写）
          </label>
        </section>

        {/* 候选菜谱 */}
        <section className="rounded-2xl bg-white p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-ink/80">
              备选菜品池（已选 {selectedRecipeIds.length} 道）
            </h2>
            <button
              type="button"
              onClick={() =>
                setSelectedRecipeIds(
                  selectedRecipeIds.length === availableRecipes.length
                    ? []
                    : availableRecipes.map((r) => r.id)
                )
              }
              className="text-xs text-brand font-semibold"
            >
              {selectedRecipeIds.length === availableRecipes.length ? '取消全选' : '全选'}
            </button>
          </div>

          <div className="space-y-2 max-h-60 overflow-y-auto">
            {availableRecipes.map((r) => {
              const isSelected = selectedRecipeIds.includes(r.id)
              return (
                <div
                  key={r.id}
                  onClick={() => toggleRecipe(r.id)}
                  className={`flex items-center justify-between p-3 rounded-xl border text-xs cursor-pointer ${
                    isSelected ? 'border-brand bg-brand-soft/40 font-medium' : 'border-neutral-100 bg-neutral-50/50'
                  }`}
                >
                  <span>{r.title}</span>
                  <span>{isSelected ? '✓' : '+'}</span>
                </div>
              )
            })}
          </div>
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
          {submitting ? '生成中…' : '生成点单分享链接'}
        </button>
      </form>
    </main>
  )
}
