'use client'

import { useEffect, useState } from 'react'

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
  const [freeTextDish, setFreeTextDish] = useState('')
  const [note, setNote] = useState('')
  const [clientKey, setClientKey] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  // 本地生成/读取持久化的匿名 clientKey
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
    } else {
      if (selectedIds.length >= perPersonLimit) {
        alert(`每人最多点 ${perPersonLimit} 道菜`)
        return
      }
      setSelectedIds([...selectedIds, id])
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nickname.trim()) {
      setError('请填一下怎么称呼你')
      return
    }

    const items: Array<{ recipeId?: string; freeText?: string; servings: number; note?: string }> =
      selectedIds.map((id) => ({
        recipeId: id,
        servings: 1,
      }))

    if (freeTextDish.trim()) {
      items.push({
        freeText: freeTextDish.trim(),
        servings: 1,
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
      <section className="rounded-2xl bg-white p-8 text-center shadow-sm space-y-4">
        <div className="text-4xl">🎉</div>
        <h2 className="text-lg font-bold text-ink">点单成功！</h2>
        <p className="text-xs text-ink/60 leading-5">
          大厨已收到你的心愿菜单。稍后大厨可能会发来缺失食材清单让大家帮忙带哦。
        </p>
        <button
          type="button"
          onClick={() => setSuccess(false)}
          className="text-xs text-brand underline font-medium"
        >
          修改我点的菜
        </button>
      </section>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* 身份区 */}
      <section className="rounded-2xl bg-white p-5 shadow-sm space-y-3">
        <label className="block text-xs font-semibold text-ink/70">你的昵称 / 称呼</label>
        <input
          type="text"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder="如：小王、媳妇、阿强"
          className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm font-medium"
          required
        />
      </section>

      {/* 候选菜单列表 */}
      <section className="rounded-2xl bg-white p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold text-ink/80">
            候选菜单（已选 {selectedIds.length}/{perPersonLimit}）
          </h2>
        </div>

        <div className="space-y-2">
          {recipes.map((r) => {
            const isChecked = selectedIds.includes(r.id)
            return (
              <div
                key={r.id}
                onClick={() => toggleSelect(r.id)}
                className={`flex items-center justify-between rounded-xl p-3.5 border transition cursor-pointer ${
                  isChecked
                    ? 'border-brand bg-brand-soft/40'
                    : 'border-neutral-100 bg-neutral-50/50'
                }`}
              >
                <div>
                  <p className="text-sm font-semibold text-ink">{r.title}</p>
                  <p className="text-xs text-ink/50 mt-0.5">⏱ {r.minutes} 分钟 · 难度 {'⭐'.repeat(r.difficulty)}</p>
                </div>
                <div
                  className={`size-5 rounded-full border flex items-center justify-center text-xs font-bold ${
                    isChecked
                      ? 'border-brand bg-brand text-white'
                      : 'border-neutral-300 bg-white'
                  }`}
                >
                  {isChecked ? '✓' : ''}
                </div>
              </div>
            )
          })}
        </div>

        {allowFreeInput && (
          <div className="pt-3 border-t border-neutral-100">
            <label className="block text-xs font-semibold text-ink/60 mb-1">
              想吃库里没有的？自由报菜名：
            </label>
            <input
              type="text"
              value={freeTextDish}
              onChange={(e) => setFreeTextDish(e.target.value)}
              placeholder="如：可乐鸡翅、清蒸鲈鱼"
              className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-xs"
            />
          </div>
        )}
      </section>

      {/* 忌口/口味备注 */}
      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <label className="block text-xs font-semibold text-ink/70 mb-1">
          口味 / 忌口备注（选填）
        </label>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="如：不放香菜、微辣、少油"
          className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-xs"
        />
      </section>

      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-2xl bg-brand py-4 text-center font-semibold text-white shadow-sm disabled:opacity-50 active:scale-98"
      >
        {submitting ? '提交中…' : '选好了，提交点单'}
      </button>
    </form>
  )
}
