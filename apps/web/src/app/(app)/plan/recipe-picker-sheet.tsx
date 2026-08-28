'use client'

import { useEffect, useState } from 'react'
import type { MealType } from '@kaifan/shared'
import { Segmented } from '@/components/ui'

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

  const MODE_OPTIONS = [
    { value: 'search' as const, label: '从菜谱库选' },
    { value: 'free' as const, label: '自由填菜名' },
  ]

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40" role="dialog" onClick={onClose}>
      <div
        className="max-h-[75dvh] w-full overflow-y-auto rounded-t-3xl bg-paper px-5 pt-4 pb-8"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-2 h-1 w-10 rounded-full bg-ink-3/30 mx-auto" />
        <h2 className="text-center text-[15px] font-bold text-ink">
          安排 {Number(target.planDate.slice(5, 7))}月{Number(target.planDate.slice(8, 10))}日 ·{' '}
          {{ breakfast: '早餐', lunch: '午餐', dinner: '晚餐', supper: '夜宵' }[target.mealType]}
        </h2>

        <div className="my-3">
          <Segmented options={MODE_OPTIONS} value={mode} onChange={setMode} />
        </div>

        {mode === 'search' ? (
          <>
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="输入菜名关键字，如：红烧肉"
              className="field text-[13px] mb-3"
              autoFocus
            />
            <div className="max-h-64 space-y-1.5 overflow-y-auto">
              {searching && <p className="py-4 text-center text-xs text-ink-3">搜索中…</p>}
              {!searching && query.trim() && results.length === 0 && (
                <p className="py-4 text-center text-xs text-ink-3">没找到匹配菜谱，可切到「自由填菜名」</p>
              )}
              {results.map((recipe) => (
                <button
                  key={recipe.id}
                  type="button"
                  onClick={() => onConfirm(target, recipe.id, recipe.title)}
                  className="flex w-full items-center justify-between rounded-xl bg-surface px-4 py-3 text-left transition active:bg-fill"
                >
                  <span className="text-[14px] font-medium text-ink">{recipe.title}</span>
                  <span className="text-[12px] text-ink-3">⏱ {recipe.minutes}m</span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="space-y-3">
            <input
              type="text"
              value={freeText}
              onChange={(event) => setFreeText(event.target.value)}
              placeholder="如：妈妈牌饺子"
              className="field text-[13px]"
              autoFocus
            />
            <button
              type="button"
              disabled={!freeText.trim()}
              onClick={() => onConfirm(target, null, freeText.trim())}
              className="btn-primary py-3 text-[14px]"
            >
              确定安排这顿
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
