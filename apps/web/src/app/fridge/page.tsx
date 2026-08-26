'use client'

import Link from 'next/link'
import { useState } from 'react'
import type { FridgeMatch } from '@/app/api/recipes/by-ingredients/route'
import { useAuth } from '@/components/auth-provider'

const POPULAR_INGREDIENTS = ['鸡蛋', '西红柿', '土豆', '青椒', '五花肉', '鸡胸肉', '豆腐', '洋葱', '胡萝卜', '蒜苔', '虾仁', '面条']

/** 把一句话机械拆分为食材 chips（如「我有鸡蛋和西红柿」→ 鸡蛋 / 西红柿） */
function splitIntoNames(text: string): string[] {
  return text
    .split(/[,，、。;；\s]+|我?有|和|跟|与|还有|能做|什么|可以|家里/g)
    .map((part) => part.trim())
    .filter((part) => part.length > 0 && part.length <= 10)
}

export default function FridgePage() {
  const { user, getAccessToken } = useAuth()
  const [inputText, setInputText] = useState('')
  const [chips, setChips] = useState<string[]>([])
  const [matches, setMatches] = useState<FridgeMatch[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState('')
  // 记录已加入购物清单的菜谱 id，防重复点击
  const [addedToShopping, setAddedToShopping] = useState<Record<string, boolean>>({})
  const [shoppingMsg, setShoppingMsg] = useState('')

  const addChip = (raw: string) => {
    const names = raw.includes(',') || /[，、\s]/.test(raw) ? splitIntoNames(raw) : [raw.trim()]
    setChips((prev) => {
      const next = [...prev]
      for (const name of names) {
        if (name && !next.includes(name)) next.push(name)
      }
      return next.slice(0, 12)
    })
    setInputText('')
  }

  const removeChip = (name: string) => {
    setChips((prev) => prev.filter((chip) => chip !== name))
  }

  const togglePopular = (name: string) => {
    if (chips.includes(name)) removeChip(name)
    else addChip(name)
  }

  const handleSearch = async () => {
    if (chips.length === 0) return
    setSearching(true)
    setError('')
    try {
      const response = await fetch('/api/recipes/by-ingredients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ingredients: chips }),
      })
      const body = (await response.json()) as { matches?: FridgeMatch[]; error?: string }
      if (!response.ok || !body.matches) throw new Error(body.error || '搜索失败')
      setMatches(body.matches)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSearching(false)
    }
  }

  /** 把某道菜的缺失食材一键并入购物清单（需登录） */
  const addMissingToShoppingList = async (match: FridgeMatch) => {
    if (!user) {
      setShoppingMsg('加入购物清单需要先登录（首页右上角）')
      return
    }
    try {
      const token = await getAccessToken()
      if (!token) throw new Error('登录状态已失效')

      const response = await fetch('/api/shopping-lists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          items: match.missNames.map((name) => ({ name, checked: false, sourceRecipeTitle: match.title })),
        }),
      })
      if (!response.ok) {
        const body = (await response.json()) as { error?: string }
        throw new Error(body.error ?? '保存失败')
      }
      setAddedToShopping((prev) => ({ ...prev, [match.id]: true }))
      setShoppingMsg(`「${match.title}」的缺失食材已并入购物清单 🛒`)
    } catch (err) {
      setShoppingMsg((err as Error).message)
    }
  }

  return (
    <main className="mx-auto min-h-dvh w-full max-w-md px-5 pt-10 pb-16">
      <header className="mb-6">
        <Link href="/" className="mb-1 inline-block text-xs text-ink/50">← 返回首页</Link>
        <h1 className="text-xl font-bold">🧊 清冰箱做菜</h1>
        <p className="text-xs text-ink/60">输入现有食材，看看马上能做什么——不用登录也能搜</p>
      </header>

      {/* 输入区 */}
      <section className="mb-4 rounded-2xl bg-white p-4 shadow-sm space-y-3">
        <form
          onSubmit={(event) => {
            event.preventDefault()
            if (inputText.trim()) addChip(inputText)
          }}
          className="flex gap-2"
        >
          <input
            type="text"
            value={inputText}
            onChange={(event) => setInputText(event.target.value)}
            placeholder="输入食材回车添加，或贴整句「鸡蛋 西红柿」"
            className="min-w-0 flex-1 rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-brand"
          />
          <button
            type="submit"
            disabled={!inputText.trim()}
            className="shrink-0 rounded-lg bg-neutral-100 px-3 py-2 text-xs font-medium text-ink/70 disabled:opacity-40"
          >
            添加
          </button>
        </form>

        {/* 已添加 chips */}
        {chips.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {chips.map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => removeChip(chip)}
                className="flex items-center gap-1 rounded-full bg-brand px-3 py-1 text-xs font-medium text-white active:scale-95"
              >
                {chip} <span className="opacity-70">×</span>
              </button>
            ))}
          </div>
        )}

        {/* 热门快捷 */}
        <div>
          <p className="mb-1.5 text-[11px] text-ink/45">常用食材点选：</p>
          <div className="flex flex-wrap gap-1.5">
            {POPULAR_INGREDIENTS.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => togglePopular(name)}
                className={`rounded-full px-2.5 py-1 text-xs transition ${
                  chips.includes(name)
                    ? 'bg-brand text-white'
                    : 'bg-neutral-100 text-ink/70 active:bg-neutral-200'
                }`}
              >
                {name}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={() => void handleSearch()}
          disabled={searching || chips.length === 0}
          className="w-full rounded-xl bg-brand py-3 text-sm font-semibold text-white shadow-sm disabled:opacity-50 active:scale-[0.99]"
        >
          {searching ? '翻菜谱中…' : `看看这 ${chips.length} 样能做什么`}
        </button>

        {error && (
          <p className="rounded-lg bg-red-50 p-2.5 text-xs text-red-700">{error}</p>
        )}
      </section>

      {shoppingMsg && (
        <p className="mb-4 rounded-xl bg-green-50 p-3 text-xs leading-5 text-green-800">
          {shoppingMsg}
          {user && <Link href="/shopping-list" className="ml-1 font-semibold underline">去购物清单 →</Link>}
        </p>
      )}

      {/* 结果区 */}
      {matches !== null && (
        <section className="space-y-3">
          {matches.length === 0 ? (
            <div className="rounded-2xl bg-white p-8 text-center shadow-sm space-y-2">
              <p className="text-3xl">🥲</p>
              <h2 className="text-sm font-semibold">这些食材凑不出一道完整的菜</h2>
              <p className="text-xs leading-5 text-ink/50">试着再加一两样常见配菜（如鸡蛋、葱蒜），或换掉其中一样</p>
            </div>
          ) : (
            <>
              <h2 className="px-1 text-xs font-bold text-ink/60">
                能做 {matches.length} 道 · 按「命中最多 → 缺得最少 → 最快」排序
              </h2>
              {matches.map((match) => (
                <article key={match.id} className="rounded-2xl bg-white p-4 shadow-sm">
                  <Link href={`/recipes/${encodeURIComponent(match.id)}`} className="active:opacity-80">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <h3 className="font-bold text-sm text-ink">{match.title}</h3>
                      <span className="shrink-0 text-[11px] text-ink/45">
                        ⏱ {match.minutes} 分钟 · {'⭐'.repeat(match.difficulty)}
                      </span>
                    </div>
                  </Link>

                  <div className="space-y-1 text-xs">
                    <p className="leading-5 text-green-700">
                      <span className="font-semibold">✓ 有：</span>{match.haveNames.join('、')}
                    </p>
                    {match.missNames.length > 0 ? (
                      <p className="leading-5 text-red-500">
                        <span className="font-semibold">✗ 缺：</span>{match.missNames.join('、')}
                      </p>
                    ) : (
                      <p className="font-medium leading-5 text-green-600">🎉 食材全齐，直接开做！</p>
                    )}
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-2 border-t border-neutral-100 pt-2.5">
                    <span className="text-[10px] text-ink/40">
                      可做 {match.haveNames.length}/{match.haveNames.length + match.missNames.length} 样必选食材
                    </span>
                    {match.missNames.length > 0 && (
                      <button
                        type="button"
                        onClick={() => void addMissingToShoppingList(match)}
                        disabled={addedToShopping[match.id]}
                        className="rounded-lg bg-brand-soft px-3 py-1.5 text-[11px] font-semibold text-brand-deep active:scale-95 disabled:opacity-50"
                      >
                        {addedToShopping[match.id] ? '✓ 已在购物清单' : '🛒 缺的进购物清单'}
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </>
          )}
        </section>
      )}
    </main>
  )
}
