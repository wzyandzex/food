'use client'

import Link from 'next/link'
import { useState } from 'react'
import type { RecipeV1 } from '@kaifan/shared'
import { useAuth } from '@/components/auth-provider'

interface RecipeDetailInteractiveProps {
  recipe: RecipeV1
}

export function RecipeDetailInteractive({ recipe }: RecipeDetailInteractiveProps) {
  const { user, getAccessToken } = useAuth()
  // 本地交互态：食材勾选「家里有」
  const [haveIngredients, setHaveIngredients] = useState<Record<number, boolean>>({})
  // 本地交互态：步骤完成进度
  const [doneSteps, setDoneSteps] = useState<Record<number, boolean>>({})
  const [addingToShoppingList, setAddingToShoppingList] = useState(false)
  const [addedSuccess, setAddedSuccess] = useState(false)
  const [addError, setAddError] = useState('')

  const toggleIngredient = (index: number) => {
    setHaveIngredients((prev) => ({ ...prev, [index]: !prev[index] }))
  }

  const toggleStep = (index: number) => {
    setDoneSteps((prev) => ({ ...prev, [index]: !prev[index] }))
  }

  // 一键将「家里没有」的食材加入购物清单（支持游客 LocalStorage 暂存）
  const handleAddToShoppingList = async () => {
    const missingIngredients = recipe.ingredients.filter((_, idx) => !haveIngredients[idx])
    if (missingIngredients.length === 0) {
      setAddError('所有食材都已标记为「家里有」啦！')
      return
    }

    setAddingToShoppingList(true)
    setAddError('')

    const itemsToAppend = missingIngredients.map((ing) => ({
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `item_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name: ing.name,
      qty: ing.qty ?? null,
      unit: ing.unit ?? '',
      checked: false,
      sourceRecipeTitle: recipe.title,
    }))

    try {
      // 1. 游客模式：直接合并存入 LocalStorage
      if (!user) {
        const raw = localStorage.getItem('kaifan_guest_shopping_list')
        const currentList: typeof itemsToAppend = raw ? JSON.parse(raw) : []
        const mergedMap = new Map<string, (typeof itemsToAppend)[0]>()

        for (const item of currentList) {
          mergedMap.set(`${item.name}__${item.unit || ''}`, { ...item })
        }
        for (const item of itemsToAppend) {
          const key = `${item.name}__${item.unit || ''}`
          const exist = mergedMap.get(key)
          if (exist) {
            if (typeof exist.qty === 'number' && typeof item.qty === 'number') {
              exist.qty += item.qty
            } else if (typeof item.qty === 'number') {
              exist.qty = item.qty
            }
          } else {
            mergedMap.set(key, item)
          }
        }

        localStorage.setItem(
          'kaifan_guest_shopping_list',
          JSON.stringify(Array.from(mergedMap.values())),
        )
        setAddedSuccess(true)
        setTimeout(() => setAddedSuccess(false), 3500)
        return
      }

      // 2. 登录模式：调用服务端 API
      const token = await getAccessToken()
      if (!token) throw new Error('未获取到有效登录令牌')

      const res = await fetch('/api/shopping-lists', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          items: itemsToAppend,
        }),
      })

      const data = (await res.json()) as { ok?: boolean; error?: string }
      if (!res.ok || !data.ok) {
        throw new Error(data.error || '加入购物清单失败')
      }

      setAddedSuccess(true)
      setTimeout(() => setAddedSuccess(false), 3500)
    } catch (err) {
      setAddError((err as Error).message)
    } finally {
      setAddingToShoppingList(false)
    }
  }

  const completedStepsCount = Object.values(doneSteps).filter(Boolean).length
  const totalSteps = recipe.steps.length
  const progressPercent = totalSteps > 0 ? Math.round((completedStepsCount / totalSteps) * 100) : 0

  return (
    <div className="space-y-6">
      {/* 食材表（含用量、支持勾选「家里有」） */}
      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">食材清单</h2>
          <span className="text-xs text-ink/40">点击可勾选「家里有」</span>
        </div>
        <ul className="space-y-2 text-sm">
          {recipe.ingredients.map((ingredient, index) => {
            const hasIt = Boolean(haveIngredients[index])
            return (
              <li
                key={`${ingredient.name}-${index}`}
                onClick={() => toggleIngredient(index)}
                className={`flex cursor-pointer select-none items-center justify-between rounded-xl p-2 transition-colors ${
                  hasIt ? 'bg-green-50/70 text-green-900' : 'hover:bg-neutral-50'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <input
                    type="checkbox"
                    checked={hasIt}
                    onChange={() => {}}
                    className="size-4 rounded accent-green-600"
                    aria-label={`标记家里有 ${ingredient.name}`}
                  />
                  <span className={hasIt ? 'line-through opacity-70' : ''}>
                    {ingredient.name}
                    {ingredient.optional && (
                      <span className="ml-1 text-xs text-ink/40">（可选）</span>
                    )}
                  </span>
                </div>
                <span className="text-xs text-ink/55">
                  {ingredient.qty != null ? `${ingredient.qty} ${ingredient.unit ?? ''}` : ''}
                </span>
              </li>
            )
          })}
        </ul>

        {/* 存入购物清单按钮 */}
        <div className="mt-4 pt-3 border-t border-neutral-100 flex flex-col gap-2">
          {addError && <p className="text-xs text-red-500">{addError}</p>}
          {addedSuccess ? (
            <div className="flex items-center justify-between rounded-xl bg-green-50 px-3 py-2 text-xs text-green-800">
              <span>✓ 已将未备齐食材加入购物清单！</span>
              <Link href="/shopping-list" className="underline font-semibold">
                去查看 →
              </Link>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleAddToShoppingList}
              disabled={addingToShoppingList}
              className="w-full rounded-xl bg-brand-soft py-2 text-center text-xs font-semibold text-brand-deep active:scale-98 disabled:opacity-50"
            >
              {addingToShoppingList ? '正在添加…' : '🛒 将未有食材一键加入购物清单'}
            </button>
          )}
        </div>
      </section>

      {/* 分步骤做法（支持勾选进度） */}
      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">做法步骤</h2>
          {totalSteps > 0 && (
            <span className="text-xs text-ink/50">
              进度 {completedStepsCount}/{totalSteps}（{progressPercent}%）
            </span>
          )}
        </div>

        {totalSteps > 0 && (
          <div className="mb-4 h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
            <div
              className="h-full bg-brand transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        )}

        <ol className="space-y-3">
          {recipe.steps.map((step, index) => {
            const done = Boolean(doneSteps[index])
            return (
              <li
                key={index}
                onClick={() => toggleStep(index)}
                className={`flex cursor-pointer select-none gap-3 rounded-xl p-2.5 text-sm leading-6 transition-colors ${
                  done ? 'bg-brand-soft/60 text-ink/60' : 'hover:bg-neutral-50'
                }`}
              >
                <span
                  className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                    done ? 'bg-green-600 text-white' : 'bg-brand text-white'
                  }`}
                >
                  {done ? '✓' : index + 1}
                </span>
                <span className={done ? 'line-through' : ''}>
                  {step.text}
                  {step.durationMinutes != null && (
                    <span className="ml-1 text-xs text-ink/40">
                      （约 {step.durationMinutes} 分钟）
                    </span>
                  )}
                </span>
              </li>
            )
          })}
        </ol>
      </section>

      {/* 营养估算（选填字段，有才展示，PRD §4.2） */}
      {recipe.nutrition && Object.keys(recipe.nutrition).length > 0 && (
        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="mb-3 font-semibold">营养参考（每份估算）</h2>
          <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
            {recipe.nutrition.calories != null && (
              <div className="rounded-xl bg-neutral-50 p-3 text-center">
                <span className="text-ink/45">热量</span>
                <p className="mt-1 font-bold text-ink">{recipe.nutrition.calories} kcal</p>
              </div>
            )}
            {recipe.nutrition.protein != null && (
              <div className="rounded-xl bg-neutral-50 p-3 text-center">
                <span className="text-ink/45">蛋白质</span>
                <p className="mt-1 font-bold text-ink">{recipe.nutrition.protein} g</p>
              </div>
            )}
            {recipe.nutrition.fat != null && (
              <div className="rounded-xl bg-neutral-50 p-3 text-center">
                <span className="text-ink/45">脂肪</span>
                <p className="mt-1 font-bold text-ink">{recipe.nutrition.fat} g</p>
              </div>
            )}
            {recipe.nutrition.carbs != null && (
              <div className="rounded-xl bg-neutral-50 p-3 text-center">
                <span className="text-ink/45">碳水</span>
                <p className="mt-1 font-bold text-ink">{recipe.nutrition.carbs} g</p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* 来源与作者署名（PRD §4.2） */}
      {(recipe.sourceUrl || recipe.sourceType || recipe.authorNote) && (
        <footer className="space-y-1.5 rounded-2xl bg-neutral-50 p-4 text-xs text-ink/60">
          {recipe.authorNote && <p className="font-medium text-ink/80">{recipe.authorNote}</p>}
          <div className="flex flex-wrap items-center gap-2">
            <span>来源渠道：{recipe.sourceType}</span>
            {recipe.sourceUrl && (
              <>
                <span>·</span>
                <a
                  href={recipe.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand underline"
                >
                  查看原出处 ↗
                </a>
              </>
            )}
          </div>
        </footer>
      )}
    </div>
  )
}
