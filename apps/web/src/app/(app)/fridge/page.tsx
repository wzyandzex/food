'use client'

import Link from 'next/link'
import { useState } from 'react'
import type { FridgeMatch } from '@/app/api/recipes/by-ingredients/route'
import { useAuth } from '@/components/auth-provider'
import { IconCheck, IconChevronRight, IconPlus, IconX } from '@/components/icons'
import { NavBar } from '@/components/ui'

const COMMON_INGREDIENTS = [
  '鸡蛋', '西红柿', '土豆', '青椒', '五花肉', '鸡胸肉',
  '豆腐', '洋葱', '胡萝卜', '葱姜蒜', '虾仁', '面条',
]

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

  const addMissingToShoppingList = async (match: FridgeMatch) => {
    if (!user) {
      setShoppingMsg('加入购物清单需要先登录')
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
      setShoppingMsg(`「${match.title}」的缺失食材已存入清单`)
    } catch (err) {
      setShoppingMsg((err as Error).message)
    }
  }

  return (
    <div className="screen">
      <NavBar title="清冰箱" back="/" backLabel="首页" />

      {/* 原生 App 式：选择食材形成状态 */}
      <section className="mt-3 card p-4 space-y-3">
        <p className="text-[15px] font-semibold text-ink">今天冰箱里有什么？</p>

        {/* 手动输入 */}
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (inputText.trim()) addChip(inputText)
          }}
          className="flex gap-2"
        >
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="输入食材点添加，或贴整句「鸡蛋 西红柿」"
            className="field text-[13px]"
          />
          <button
            type="submit"
            disabled={!inputText.trim()}
            className="shrink-0 rounded-xl bg-fill px-4 py-2 text-[13px] font-semibold text-ink disabled:opacity-40"
          >
            添加
          </button>
        </form>

        {/* 常用食材点选 */}
        <div>
          <p className="mb-2 text-[12px] text-ink-3">常见食材：</p>
          <div className="flex flex-wrap gap-1.5">
            {COMMON_INGREDIENTS.map((name) => {
              const selected = chips.includes(name)
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => togglePopular(name)}
                  className={`chip text-[12px] ${selected ? 'chip-on' : ''}`}
                >
                  {selected ? <IconCheck className="size-3" /> : <IconPlus className="size-3" />}
                  {name}
                </button>
              )
            })}
          </div>
        </div>

        {/* 已选食材 */}
        {chips.length > 0 && (
          <div className="pt-2 border-t border-line">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[12px] text-ink-3">已选 {chips.length} 样：</span>
              <button
                type="button"
                onClick={() => setChips([])}
                className="text-[12px] text-ink-3 hover:text-danger"
              >
                清空
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {chips.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => removeChip(chip)}
                  className="chip chip-on text-[12px]"
                >
                  {chip} <IconX className="size-3 opacity-70" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 主 CTA：能做什么？ */}
        <button
          type="button"
          onClick={() => void handleSearch()}
          disabled={searching || chips.length === 0}
          className="btn-primary mt-2"
        >
          {searching ? '翻菜谱中…' : chips.length === 0 ? '选几样食材看看能做什么' : `能做什么菜？（${chips.length} 样）`}
        </button>

        {error && <p className="text-[12px] text-danger">{error}</p>}
      </section>

      {shoppingMsg && (
        <p className="mt-3 card p-3 text-[12px] leading-5 text-success bg-success-soft">
          {shoppingMsg}
          {user && <Link href="/shopping-list" className="ml-1 font-semibold underline">去购物清单 →</Link>}
        </p>
      )}

      {/* 结果区：推荐菜谱 */}
      {matches !== null && (
        <section className="mt-6">
          <div className="flex items-center justify-between px-1 mb-2">
            <h2 className="text-[13px] font-medium text-ink-3">
              {matches.length === 0 ? '没有匹配' : `能做 ${matches.length} 道 · 按齐备度排序`}
            </h2>
          </div>

          {matches.length === 0 ? (
            <div className="card p-8 text-center space-y-1.5">
              <p className="text-[15px] font-semibold text-ink">这些食材凑不出一道完整的菜</p>
              <p className="text-[12px] leading-5 text-ink-3">试着再加一两样常见配料（如鸡蛋、葱姜蒜），或换掉其中一样</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {matches.map((match) => (
                <article key={match.id} className="card p-4 space-y-2">
                  <Link
                    href={`/recipes/${encodeURIComponent(match.id)}`}
                    className="flex items-center justify-between gap-2 active:opacity-60"
                  >
                    <div>
                      <h3 className="text-[15px] font-semibold text-ink">{match.title}</h3>
                      <p className="mt-0.5 text-[12px] text-ink-3">
                        ⏱ {match.minutes} 分钟 · {'★'.repeat(match.difficulty)}
                      </p>
                    </div>
                    <IconChevronRight className="size-4 text-ink-3/60" />
                  </Link>

                  <div className="space-y-0.5 text-[12px]">
                    <p className="text-success">
                      <span className="font-semibold">✓ 有：</span>
                      {match.haveNames.join('、')}
                    </p>
                    {match.missNames.length > 0 ? (
                      <p className="text-danger">
                        <span className="font-semibold">✗ 缺：</span>
                        {match.missNames.join('、')}
                      </p>
                    ) : (
                      <p className="font-medium text-success">🎉 食材全齐，马上能开做！</p>
                    )}
                  </div>

                  {match.missNames.length > 0 && (
                    <div className="pt-2 border-t border-line flex items-center justify-between">
                      <span className="text-[11px] text-ink-3">
                        齐备度 {match.haveNames.length}/{match.haveNames.length + match.missNames.length}
                      </span>
                      <button
                        type="button"
                        onClick={() => void addMissingToShoppingList(match)}
                        disabled={addedToShopping[match.id]}
                        className="rounded-lg bg-tint-soft px-2.5 py-1 text-[11px] font-semibold text-tint-deep transition active:scale-95 disabled:opacity-40"
                      >
                        {addedToShopping[match.id] ? '✓ 已在清单' : '🛒 缺的进清单'}
                      </button>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  )
}
