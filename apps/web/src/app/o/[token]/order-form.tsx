'use client'

import { useEffect, useState } from 'react'
import { IconCheck } from '@/components/icons'

interface RecipeOption {
  id: string
  title: string
  minutes: number
  difficulty: number
}

interface OrderFormProps {
  token: string
  perPersonLimit: number
  allowFreeInput: boolean
  recipes: RecipeOption[]
}

export default function OrderForm({
  token,
  perPersonLimit,
  allowFreeInput,
  recipes,
}: OrderFormProps) {
  const [nickname, setNickname] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [servingsById, setServingsById] = useState<Record<string, number>>({})
  const [freeTextDish, setFreeTextDish] = useState('')
  const [freeTextServings, setFreeTextServings] = useState(1)
  const [note, setNote] = useState('')
  const [clientKey, setClientKey] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let key = localStorage.getItem('kaifan_client_key')
    if (!key) {
      key = `client_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
      localStorage.setItem('kaifan_client_key', key)
    }
    setClientKey(key)

    const savedNickname = localStorage.getItem('kaifan_orderer_nickname')
    if (savedNickname) setNickname(savedNickname)
  }, [])

  const toggleSelect = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((item) => item !== id))
      setServingsById((prev) => {
        const next = { ...prev }
        delete next[id]
        return next
      })
    } else {
      if (selectedIds.length >= perPersonLimit) {
        alert(`每人最多点 ${perPersonLimit} 道菜`)
        return
      }
      setSelectedIds([...selectedIds, id])
      setServingsById((prev) => ({ ...prev, [id]: 1 }))
    }
  }

  const changeServings = (id: string, delta: number) => {
    setServingsById((prev) => {
      const value = (prev[id] ?? 1) + delta
      return { ...prev, [id]: Math.min(9, Math.max(1, value)) }
    })
  }

  const ServingsStepper = ({ id }: { id: string }) => (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          changeServings(id, -1)
        }}
        className="size-6 rounded-full bg-fill text-[12px] font-bold text-ink-2 active:bg-fill-strong"
        aria-label="减少份数"
      >
        −
      </button>
      <span className="w-4 text-center text-[12px] font-semibold text-tint-deep">
        ×{servingsById[id] ?? 1}
      </span>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          changeServings(id, 1)
        }}
        className="size-6 rounded-full bg-fill text-[12px] font-bold text-ink-2 active:bg-fill-strong"
        aria-label="增加份数"
      >
        ＋
      </button>
    </div>
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nickname.trim()) {
      setError('请填一下怎么称呼你')
      return
    }

    const items: Array<{ recipeId?: string; freeText?: string; servings: number; note?: string }> =
      selectedIds.map((id) => ({
        recipeId: id,
        servings: servingsById[id] ?? 1,
      }))

    if (freeTextDish.trim()) {
      items.push({
        freeText: freeTextDish.trim(),
        servings: freeTextServings,
      })
    }

    if (items.length === 0) {
      setError('请至少勾选一道菜或报个菜名')
      return
    }

    setSubmitting(true)
    setError('')

    try {
      localStorage.setItem('kaifan_orderer_nickname', nickname.trim())

      const res = await fetch('/api/orders/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          nickname: nickname.trim(),
          clientKey,
          items: items.map((it) => ({ ...it, note })),
        }),
      })

      const data = (await res.json()) as { ok?: boolean; error?: string }
      if (!res.ok || !data.ok) {
        throw new Error(data.error || '提交失败')
      }

      setSuccess(true)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  if (success) {
    return (
      <section className="card p-8 text-center space-y-3">
        <p className="text-[44px]">🎉</p>
        <h2 className="text-[18px] font-bold text-ink">点单成功！</h2>
        <p className="text-[13px] text-ink-2 leading-5">
          大厨已收到你的心愿菜单。大厨发来采购清单时记得帮忙带食材哦。
        </p>
        <button
          type="button"
          onClick={() => setSuccess(false)}
          className="text-[13px] text-tint underline font-medium"
        >
          修改我点的菜
        </button>
      </section>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* 称呼 */}
      <section className="card p-4 space-y-2">
        <label className="block text-[12px] font-medium text-ink-3">你的昵称 / 称呼 *</label>
        <input
          type="text"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder="如：小王、媳妇、阿强"
          className="field text-[14px] font-medium"
          required
        />
      </section>

      {/* 候选菜单列表 */}
      <section className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-[13px] font-medium text-ink-3">
            候选菜单（已选 {selectedIds.length}/{perPersonLimit}）
          </h2>
        </div>

        <div className="list-group">
          {recipes.map((r, idx) => {
            const isChecked = selectedIds.includes(r.id)
            const isLast = idx === recipes.length - 1
            return (
              <div
                key={r.id}
                onClick={() => toggleSelect(r.id)}
                className={`flex cursor-pointer items-center justify-between px-4 py-3 transition-colors active:bg-fill ${
                  isLast ? '' : 'border-b border-line'
                } ${isChecked ? 'bg-tint-soft/50' : ''}`}
              >
                <div>
                  <p className="text-[15px] font-semibold text-ink">{r.title}</p>
                  <p className="mt-0.5 text-[12px] text-ink-3">⏱ {r.minutes} 分钟 · {'★'.repeat(r.difficulty)}</p>
                </div>
                <div className="flex items-center gap-2">
                  {isChecked && <ServingsStepper id={r.id} />}
                  <div
                    className={`flex size-5 items-center justify-center rounded-full border transition-colors ${
                      isChecked ? 'border-tint bg-tint text-white' : 'border-ink-3/40 bg-surface'
                    }`}
                  >
                    {isChecked && <IconCheck className="size-3" />}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {allowFreeInput && (
          <div className="card p-4 space-y-2">
            <label className="block text-[12px] font-medium text-ink-3">
              想吃库里没有的？自由报菜名：
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={freeTextDish}
                onChange={(e) => setFreeTextDish(e.target.value)}
                placeholder="如：可乐鸡翅、清蒸鲈鱼"
                className="field flex-1 text-[13px]"
              />
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => setFreeTextServings((v) => Math.max(1, v - 1))}
                  className="size-6 rounded-full bg-fill text-[12px] font-bold text-ink-2"
                >
                  −
                </button>
                <span className="w-4 text-center text-[12px] font-semibold text-tint-deep">
                  ×{freeTextServings}
                </span>
                <button
                  type="button"
                  onClick={() => setFreeTextServings((v) => Math.min(9, v + 1))}
                  className="size-6 rounded-full bg-fill text-[12px] font-bold text-ink-2"
                >
                  ＋
                </button>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* 忌口/口味备注 */}
      <section className="card p-4 space-y-2">
        <label className="block text-[12px] font-medium text-ink-3">
          口味 / 忌口备注（选填）
        </label>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="如：不放香菜、微辣、少油"
          className="field text-[13px]"
        />
      </section>

      {error && <p className="card p-3 text-[12px] text-danger bg-danger-soft">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="btn-primary"
      >
        {submitting ? '提交中…' : '选好了，提交点单'}
      </button>
    </form>
  )
}
