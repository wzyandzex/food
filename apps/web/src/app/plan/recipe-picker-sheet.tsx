'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import type { MealType } from '@kaifan/shared'

interface RecipeOption {
  id: string
  title: string
  minutes: number
}

export interface PickerTarget {
  planDate: string
  mealType: MealType
}

interface RecipePickerSheetProps {
  target: PickerTarget
  onClose: () => void
  onConfirm: (target: PickerTarget, recipeId: string | null, title: string) => void
}

/** 底部弹层：搜索选菜谱或自由手填菜名 */
export function RecipePickerSheet({ target, onClose, onConfirm }: RecipePickerSheetProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<RecipeOption[]>([])
  const [searching, setSearching] = useState(false)
  const [freeText, setFreeText] = useState('')
  const [mode, setMode] = useState<'search' | 'free'>('search')

  useEffect(() => {
    if (mode !== 'search' || query.trim().length === 0) {
      setResults([])
      return
    }
    const controller = new AbortController()
    const timer = setTimeout(() => {
      setSearching(true)
      fetch(`/api/recipes/search?q=${encodeURIComponent(query.trim())}`, { signal: controller.signal })
        .then((res) => res.json())
        .then((body: { recipes?: RecipeOption[] }) => setResults(body.recipes ?? []))
        .catch(() => {})
        .finally(() => setSearching(false))
    }, 250)

    return () => {
      controller.abort()
      clearTimeout(timer)
    }
  }, [query, mode])

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/50" role="dialog" onClick={onClose}>
      <div
        className="max-h-[75dvh] w-full overflow-y-auto rounded-t-3xl bg-white px-5 pt-5 pb-8"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-1 h-1 w-10 rounded-full bg-neutral-200 mx-auto" />
        <h2 className="mt-4 text-center text-sm font-bold text-ink">
          安排 {Number(target.planDate.slice(5, 7))} 月 {Number(target.planDate.slice(8, 10))} 日 ·{' '}
          {{ breakfast: '早餐', lunch: '午餐', dinner: '晚餐', supper: '夜宵' }[target.mealType]}
        </h2>

        {/* 模式切换 */}
        <div className="my-4 flex gap-1 rounded-xl bg-neutral-100 p-1 text-xs">
          <button
            type="button"
            onClick={() => setMode('search')}
            className={`flex-1 rounded-lg py-1.5 font-medium ${mode === 'search' ? 'bg-white shadow-sm' : 'text-neutral-500'}`}
          >
            从菜谱库选
          </button>
          <button
            type="button"
            onClick={() => setMode('free')}
            className={`flex-1 rounded-lg py-1.5 font-medium ${mode === 'free' ? 'bg-white shadow-sm' : 'text-neutral-500'}`}
          >
            自由填菜名
          </button>
        </div>

        {mode === 'search' ? (
          <>
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="输入菜名关键字，如：红烧肉"
              className="mb-3 w-full rounded-lg border border-neutral-200 px-3 py-2.5 text-sm outline-none focus:border-brand"
              autoFocus
            />
            <div className="max-h-72 space-y-2 overflow-y-auto">
              {searching && <p className="py-4 text-center text-xs text-ink/40">搜索中…</p>}
              {!searching && query.trim() && results.length === 0 && (
                <p className="py-4 text-center text-xs leading-5 text-ink/40">
                  没找到「{query}」——可切换「自由填菜名」先安排上，
                  或去<Link href="/voice" className="text-brand underline">语音页</Link>逛逛菜谱库
                </p>
              )}
              {results.map((recipe) => (
                <button
                  key={recipe.id}
                  type="button"
                  onClick={() => onConfirm(target, recipe.id, recipe.title)}
                  className="flex w-full items-center justify-between rounded-xl bg-neutral-50 px-4 py-3 text-left active:bg-brand-soft"
                >
                  <span className="text-sm font-medium text-ink">{recipe.title}</span>
                  <span className="text-[11px] text-ink/45">⏱ {recipe.minutes}m</span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <input
              type="text"
              value={freeText}
              onChange={(event) => setFreeText(event.target.value)}
              placeholder="如：妈妈牌饺子（菜谱库里没有的也能安排）"
              className="mb-3 w-full rounded-lg border border-neutral-200 px-3 py-2.5 text-sm outline-none focus:border-brand"
              autoFocus
            />
            <button
              type="button"
              disabled={!freeText.trim()}
              onClick={() => onConfirm(target, null, freeText.trim())}
              className="w-full rounded-xl bg-brand py-3 text-sm font-semibold text-white shadow-sm disabled:opacity-40"
            >
              确定安排这顿
            </button>
          </>
        )}
      </div>
    </div>
  )
}
