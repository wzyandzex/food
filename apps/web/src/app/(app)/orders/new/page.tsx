'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { SAMPLE_RECIPES, type RecipeV1 } from '@kaifan/shared'
import { useAuth } from '@/components/auth-provider'
import { IconCheck, IconPlus } from '@/components/icons'
import { LoginRequired, NavBar } from '@/components/ui'

interface RecipeOption {
  id: string
  title: string
  minutes: number
  difficulty: number
}

interface CircleOption {
  id: string
  name: string
  memberCount: number
}

export default function NewOrderPage() {
  const { user, loading, getAccessToken } = useAuth()

  const [title, setTitle] = useState('今晚想吃什么？大家来点！')
  const [deadlineTime, setDeadlineTime] = useState('18:00')
  const [perPersonLimit, setPerPersonLimit] = useState(3)
  const [allowFreeInput, setAllowFreeInput] = useState(true)
  const [availableRecipes, setAvailableRecipes] = useState<RecipeOption[]>([])
  const [selectedRecipeIds, setSelectedRecipeIds] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [createdToken, setCreatedToken] = useState<string | null>(null)
  const [notifiedCount, setNotifiedCount] = useState(0)
  const [circleName, setCircleName] = useState('')
  const [error, setError] = useState('')
  const [usingSampleRecipes, setUsingSampleRecipes] = useState(false)
  const [myCircles, setMyCircles] = useState<CircleOption[]>([])
  const [selectedCircleId, setSelectedCircleId] = useState('')

  useEffect(() => {
    if (!user) return

    try {
      const preselected = sessionStorage.getItem('kaifan_order_circle_id')
      if (preselected) {
        setSelectedCircleId(preselected)
        sessionStorage.removeItem('kaifan_order_circle_id')
      }
    } catch {
      // 忽略
    }

    void (async () => {
      try {
        const accessToken = await getAccessToken()
        if (!accessToken) return
        const res = await fetch('/api/circles', { headers: { Authorization: `Bearer ${accessToken}` } })
        const body = (await res.json()) as { circles?: CircleOption[] }
        setMyCircles(body.circles ?? [])
      } catch {
        // 忽略
      }
    })()
  }, [user, getAccessToken])

  useEffect(() => {
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
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
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
          candidateRecipeIds: usingSampleRecipes ? [] : selectedRecipeIds,
          circleId: selectedCircleId || undefined,
        }),
      })

      const data = (await res.json()) as {
        ok?: boolean
        token?: string
        notifiedCount?: number
        circleName?: string | null
        error?: string
      }
      if (!res.ok || !data.ok || !data.token) {
        throw new Error(data.error || '创建点单失败')
      }

      setCreatedToken(data.token)
      setNotifiedCount(data.notifiedCount ?? 0)
      setCircleName(data.circleName ?? '')
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
        glyph="📝"
        title="需要先登录"
        description="发起点单需绑定发起人身份"
      />
    )
  }

  if (createdToken) {
    const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/o/${createdToken}` : `/o/${createdToken}`

    return (
      <div className="screen">
        <NavBar title="点单已生成" back="/orders" backLabel="点单" />
        <section className="card mt-6 p-6 text-center space-y-4">
          <p className="text-[44px]">🚀</p>
          <h1 className="text-[18px] font-bold text-ink">点单已发起！</h1>
          {circleName && notifiedCount > 0 && (
            <p className="text-[13px] leading-5 text-success font-medium">
              ✓ 已通知「{circleName}」的 {notifiedCount} 位圈友
            </p>
          )}
          <p className="text-[13px] text-ink-2 leading-5">
            把链接发给微信好友或群聊，对方点击即可免登录选菜
          </p>

          <div className="rounded-xl bg-fill p-3 text-[12px] font-mono break-all text-ink-2 select-all">
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
            className="btn-primary"
          >
            📋 一键复制分享链接
          </button>

          <div className="flex gap-2 pt-1">
            <Link
              href="/orders"
              className="flex-1 rounded-xl bg-fill py-2.5 text-center text-[13px] font-medium text-ink-2"
            >
              返回列表
            </Link>
            <Link
              href={`/o/${createdToken}`}
              className="flex-1 rounded-xl bg-tint-soft py-2.5 text-center text-[13px] font-semibold text-tint-deep"
            >
              预览点单页
            </Link>
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className="screen">
      <NavBar title="发起点单" back="/orders" backLabel="点单" />

      <form onSubmit={handleSubmit} className="mt-4 space-y-5">
        {usingSampleRecipes && (
          <div className="rounded-xl bg-caution-soft p-3 text-[12px] leading-5 text-caution">
            演示模式：尚未配置真实数据库，下方为内置样例菜单
          </div>
        )}

        <section className="card p-4 space-y-3">
          <div>
            <label className="mb-1 block text-[12px] font-medium text-ink-3">点单标题</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="field font-semibold"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-[12px] font-medium text-ink-3">今日截止时间</label>
              <input
                type="time"
                value={deadlineTime}
                onChange={(e) => setDeadlineTime(e.target.value)}
                className="field text-[13px]"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-[12px] font-medium text-ink-3">每人最多点(道)</label>
              <input
                type="number"
                min="1"
                max="10"
                value={perPersonLimit}
                onChange={(e) => setPerPersonLimit(Number(e.target.value) || 3)}
                className="field text-[13px]"
                required
              />
            </div>
          </div>

          <label className="flex items-center gap-2 pt-1 text-[13px] text-ink-2 cursor-pointer">
            <input
              type="checkbox"
              checked={allowFreeInput}
              onChange={(e) => setAllowFreeInput(e.target.checked)}
              className="rounded"
            />
            允许对方自由报菜名（库里没有的也可写）
          </label>
        </section>

        {/* 饭搭子群 */}
        {myCircles.length > 0 && (
          <section className="card p-4 space-y-2.5">
            <h2 className="text-[13px] font-medium text-ink-3">发到饭搭子群（可选）</h2>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setSelectedCircleId('')}
                className={`chip text-[12px] ${selectedCircleId === '' ? 'chip-on' : ''}`}
              >
                不发群，仅链接分享
              </button>
              {myCircles.map((circle) => (
                <button
                  key={circle.id}
                  type="button"
                  onClick={() => setSelectedCircleId(circle.id)}
                  className={`chip text-[12px] ${selectedCircleId === circle.id ? 'chip-on' : ''}`}
                >
                  👥 {circle.name}（{circle.memberCount}人）
                </button>
              ))}
            </div>
          </section>
        )}

        {/* 备选菜品池 */}
        <section className="card p-4 space-y-2.5">
          <div className="flex items-center justify-between">
            <h2 className="text-[13px] font-medium text-ink-3">
              备选菜品池（已选 {selectedRecipeIds.length} 道）
            </h2>
            <button
              type="button"
              onClick={() =>
                setSelectedRecipeIds(
                  selectedRecipeIds.length === availableRecipes.length
                    ? []
                    : availableRecipes.map((r) => r.id),
                )
              }
              className="text-[12px] font-semibold text-tint"
            >
              {selectedRecipeIds.length === availableRecipes.length ? '取消全选' : '全选'}
            </button>
          </div>

          <div className="max-h-60 space-y-1 overflow-y-auto">
            {availableRecipes.map((r) => {
              const isSelected = selectedRecipeIds.includes(r.id)
              return (
                <div
                  key={r.id}
                  onClick={() => toggleRecipe(r.id)}
                  className={`flex cursor-pointer items-center justify-between rounded-lg p-2.5 text-[13px] transition ${
                    isSelected ? 'bg-tint-soft text-tint-deep font-medium' : 'bg-fill text-ink-2'
                  }`}
                >
                  <span>{r.title}</span>
                  <span>{isSelected ? '✓' : '+'}</span>
                </div>
              )
            })}
          </div>
        </section>

        {error && <p className="card p-3 text-[12px] text-danger bg-danger-soft">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="btn-primary"
        >
          {submitting ? '生成中…' : '生成点单分享链接'}
        </button>
      </form>
    </div>
  )
}
