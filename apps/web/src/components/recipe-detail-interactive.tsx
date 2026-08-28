'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { RecipeV1 } from '@kaifan/shared'
import { useAuth } from '@/components/auth-provider'
import { IconCheck } from '@/components/icons'

interface RecipeDetailInteractiveProps {
  recipe: RecipeV1
  recipeId?: string
  derivedFromTitle?: string | null
  derivedFromId?: string | null
}

export function RecipeDetailInteractive({
  recipe,
  recipeId,
  derivedFromTitle,
  derivedFromId,
}: RecipeDetailInteractiveProps) {
  const { user, getAccessToken } = useAuth()
  const [haveIngredients, setHaveIngredients] = useState<Record<number, boolean>>({})
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

        localStorage.setItem('kaifan_guest_shopping_list', JSON.stringify(Array.from(mergedMap.values())))
        setAddedSuccess(true)
        setTimeout(() => setAddedSuccess(false), 3500)
        return
      }

      const token = await getAccessToken()
      if (!token) throw new Error('未获取到有效登录令牌')

      const res = await fetch('/api/shopping-lists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ items: itemsToAppend }),
      })

      const data = (await res.json()) as { ok?: boolean; error?: string }
      if (!res.ok || !data.ok) throw new Error(data.error || '加入购物清单失败')

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
      {/* 食材清单（列表分组，轻量勾选） */}
      <section>
        <div className="mb-1.5 flex items-center justify-between px-1">
          <h2 className="text-[13px] font-medium text-ink-3">食材清单（点击勾选「家里有」）</h2>
          <span className="text-[12px] text-ink-3">{recipe.ingredients.length} 样</span>
        </div>
        <div className="list-group">
          {recipe.ingredients.map((ingredient, index) => {
            const hasIt = Boolean(haveIngredients[index])
            const isLast = index === recipe.ingredients.length - 1
            return (
              <div
                key={`${ingredient.name}-${index}`}
                onClick={() => toggleIngredient(index)}
                className={`flex cursor-pointer select-none items-center justify-between px-4 py-3 text-sm transition-colors active:bg-fill ${
                  isLast ? '' : 'border-b border-line'
                } ${hasIt ? 'bg-fill/50 text-ink-3' : 'text-ink'}`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`flex size-4.5 items-center justify-center rounded border transition-colors ${
                      hasIt ? 'border-success bg-success text-white' : 'border-ink-3/40 bg-surface'
                    }`}
                  >
                    {hasIt && <IconCheck className="size-3" />}
                  </div>
                  <span className={hasIt ? 'line-through' : 'font-medium'}>
                    {ingredient.name}
                    {ingredient.optional && <span className="ml-1 text-[11px] text-ink-3">（可选）</span>}
                  </span>
                </div>
                <span className="text-[13px] text-ink-2">
                  {ingredient.qty != null ? `${ingredient.qty} ${ingredient.unit ?? ''}` : ''}
                </span>
              </div>
            )
          })}
        </div>

        {/* 快捷按钮 */}
        <div className="mt-2.5 flex items-center gap-2">
          <button
            type="button"
            onClick={handleAddToShoppingList}
            disabled={addingToShoppingList}
            className="flex-1 rounded-xl bg-surface py-2.5 text-center text-[13px] font-semibold text-tint transition active:bg-fill disabled:opacity-40"
          >
            {addingToShoppingList ? '正在添加…' : '🛒 缺的进清单'}
          </button>
          {recipeId && (
            <Link
              href={`/recipes/${encodeURIComponent(recipeId)}/fork`}
              className="flex-1 rounded-xl bg-surface py-2.5 text-center text-[13px] font-semibold text-ink transition active:bg-fill"
            >
              ✍️ 改编此菜
            </Link>
          )}
        </div>
        {addError && <p className="mt-1.5 px-1 text-[12px] text-danger">{addError}</p>}
        {addedSuccess && (
          <p className="mt-1.5 px-1 text-[12px] text-success font-medium">
            ✓ 已加入购物清单 · <Link href="/shopping-list" className="underline">去查看</Link>
          </p>
        )}
      </section>

      {/* 做法步骤 */}
      <section>
        <div className="mb-1.5 flex items-center justify-between px-1">
          <h2 className="text-[13px] font-medium text-ink-3">做法步骤</h2>
          {totalSteps > 0 && (
            <span className="text-[12px] text-ink-3">
              已完成 {completedStepsCount}/{totalSteps}
            </span>
          )}
        </div>

        {totalSteps > 0 && completedStepsCount > 0 && (
          <div className="mb-2 h-1 w-full overflow-hidden rounded-full bg-fill">
            <div className="h-full bg-tint transition-all duration-300" style={{ width: `${progressPercent}%` }} />
          </div>
        )}

        <div className="list-group">
          {recipe.steps.map((step, index) => {
            const done = Boolean(doneSteps[index])
            const isLast = index === recipe.steps.length - 1
            return (
              <div
                key={index}
                onClick={() => toggleStep(index)}
                className={`flex cursor-pointer select-none gap-3.5 px-4 py-3.5 text-[14px] leading-6 transition-colors active:bg-fill ${
                  isLast ? '' : 'border-b border-line'
                } ${done ? 'bg-fill/40 text-ink-3' : 'text-ink'}`}
              >
                <span
                  className={`flex size-6 shrink-0 items-center justify-center rounded-full text-[12px] font-bold ${
                    done ? 'bg-success text-white' : 'bg-fill text-ink-2'
                  }`}
                >
                  {done ? '✓' : index + 1}
                </span>
                <span className={`min-w-0 flex-1 ${done ? 'line-through' : ''}`}>
                  {step.text}
                  {step.durationMinutes != null && (
                    <span className="ml-1 text-[12px] text-ink-3">（约 {step.durationMinutes} 分钟）</span>
                  )}
                </span>
              </div>
            )
          })}
        </div>
      </section>

      {/* 营养参考 */}
      {recipe.nutrition && Object.keys(recipe.nutrition).length > 0 && (
        <section>
          <h2 className="section-label">营养参考（每份）</h2>
          <div className="card grid grid-cols-4 divide-x divide-line py-3 text-center">
            <div>
              <p className="text-[11px] text-ink-3">热量</p>
              <p className="mt-0.5 text-[14px] font-bold text-ink">{recipe.nutrition.calories ?? '--'}</p>
              <p className="text-[10px] text-ink-3">kcal</p>
            </div>
            <div>
              <p className="text-[11px] text-ink-3">蛋白质</p>
              <p className="mt-0.5 text-[14px] font-bold text-ink">{recipe.nutrition.protein ?? '--'}</p>
              <p className="text-[10px] text-ink-3">g</p>
            </div>
            <div>
              <p className="text-[11px] text-ink-3">脂肪</p>
              <p className="mt-0.5 text-[14px] font-bold text-ink">{recipe.nutrition.fat ?? '--'}</p>
              <p className="text-[10px] text-ink-3">g</p>
            </div>
            <div>
              <p className="text-[11px] text-ink-3">碳水</p>
              <p className="mt-0.5 text-[14px] font-bold text-ink">{recipe.nutrition.carbs ?? '--'}</p>
              <p className="text-[10px] text-ink-3">g</p>
            </div>
          </div>
        </section>
      )}

      {/* 来源与作者署名 */}
      {(recipe.sourceUrl || recipe.sourceType || recipe.authorNote || derivedFromTitle) && (
        <footer className="card p-4 text-[12px] leading-5 text-ink-2 space-y-1">
          {derivedFromTitle && (
            <p className="font-medium text-tint-deep">
              ✍️ 本菜谱改编自《
              {derivedFromId ? (
                <Link href={`/recipes/${encodeURIComponent(derivedFromId)}`} className="underline">
                  {derivedFromTitle}
                </Link>
              ) : (
                derivedFromTitle
              )}
              》
            </p>
          )}
          {recipe.authorNote && <p className="text-ink">{recipe.authorNote}</p>}
          <div className="flex flex-wrap items-center gap-1.5 text-ink-3">
            <span>来源：{recipe.sourceType === 'user' ? '用户原创/改编' : recipe.sourceType}</span>
            {recipe.sourceUrl && (
              <>
                <span>·</span>
                <a href={recipe.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-tint underline">
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
