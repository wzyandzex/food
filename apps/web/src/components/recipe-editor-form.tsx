'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  safeParseRecipe,
  formatRecipeIssues,
  type RecipeV1,
  type RecipeIngredientV1,
  type RecipeStepV1,
} from '@kaifan/shared'
import { useAuth } from '@/components/auth-provider'
import { IconPlus, IconX } from '@/components/icons'

interface RecipeEditorFormProps {
  initialRecipe?: Partial<RecipeV1>
  derivedFromId?: string
  parentTitle?: string
}

export function RecipeEditorForm({ initialRecipe, derivedFromId, parentTitle }: RecipeEditorFormProps) {
  const router = useRouter()
  const { getAccessToken } = useAuth()

  const [title, setTitle] = useState(initialRecipe?.title ?? '')
  const [servings, setServings] = useState(initialRecipe?.servings ?? 2)
  const [difficulty, setDifficulty] = useState(initialRecipe?.difficulty ?? 2)
  const [minutes, setMinutes] = useState(initialRecipe?.minutes ?? 20)
  const [tagInput, setTagInput] = useState('')
  const [tags, setTags] = useState<string[]>(initialRecipe?.tags ?? ['家常菜'])

  const [ingredients, setIngredients] = useState<RecipeIngredientV1[]>(
    initialRecipe?.ingredients && initialRecipe.ingredients.length > 0
      ? initialRecipe.ingredients
      : [{ name: '', optional: false }],
  )

  const [steps, setSteps] = useState<RecipeStepV1[]>(
    initialRecipe?.steps && initialRecipe.steps.length > 0
      ? initialRecipe.steps
      : [{ text: '' }],
  )

  const [calories, setCalories] = useState<string>(
    initialRecipe?.nutrition?.calories != null ? String(initialRecipe.nutrition.calories) : '',
  )
  const [protein, setProtein] = useState<string>(
    initialRecipe?.nutrition?.protein != null ? String(initialRecipe.nutrition.protein) : '',
  )
  const [fat, setFat] = useState<string>(
    initialRecipe?.nutrition?.fat != null ? String(initialRecipe.nutrition.fat) : '',
  )
  const [carbs, setCarbs] = useState<string>(
    initialRecipe?.nutrition?.carbs != null ? String(initialRecipe.nutrition.carbs) : '',
  )

  const [authorNote, setAuthorNote] = useState(
    initialRecipe?.authorNote ?? (parentTitle ? `改编自《${parentTitle}》：调整了用量与做法` : ''),
  )

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const updateIngredient = (index: number, patch: Partial<RecipeIngredientV1>) => {
    setIngredients((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)))
  }
  const addIngredient = () => setIngredients((prev) => [...prev, { name: '', optional: false }])
  const removeIngredient = (index: number) => {
    if (ingredients.length <= 1) return
    setIngredients((prev) => prev.filter((_, i) => i !== index))
  }

  const updateStep = (index: number, text: string) => {
    setSteps((prev) => prev.map((item, i) => (i === index ? { ...item, text } : item)))
  }
  const addStep = () => setSteps((prev) => [...prev, { text: '' }])
  const removeStep = (index: number) => {
    if (steps.length <= 1) return
    setSteps((prev) => prev.filter((_, i) => i !== index))
  }

  const addTag = (raw: string) => {
    const trimmed = raw.trim().replace(/^#/, '')
    if (trimmed && !tags.includes(trimmed)) setTags([...tags, trimmed])
    setTagInput('')
  }
  const removeTag = (t: string) => setTags(tags.filter((x) => x !== t))

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')

    const cleanIngredients = ingredients.filter((ing) => ing.name.trim())
    const cleanSteps = steps.filter((st) => st.text.trim())

    const numCal = calories.trim() ? Number(calories) : undefined
    const numPro = protein.trim() ? Number(protein) : undefined
    const numFat = fat.trim() ? Number(fat) : undefined
    const numCarb = carbs.trim() ? Number(carbs) : undefined
    const hasAnyNutrition = [numCal, numPro, numFat, numCarb].some((v) => typeof v === 'number' && !Number.isNaN(v))
    const nutritionPayload = hasAnyNutrition
      ? {
          calories: numCal && !Number.isNaN(numCal) ? Math.max(0, Math.round(numCal)) : undefined,
          protein: numPro && !Number.isNaN(numPro) ? Math.max(0, Math.round(numPro)) : undefined,
          fat: numFat && !Number.isNaN(numFat) ? Math.max(0, Math.round(numFat)) : undefined,
          carbs: numCarb && !Number.isNaN(numCarb) ? Math.max(0, Math.round(numCarb)) : undefined,
        }
      : undefined

    const draft = {
      schemaVersion: 'recipe.v1' as const,
      title: title.trim(),
      servings: Number(servings) || 2,
      difficulty: Math.min(5, Math.max(1, Number(difficulty) || 2)),
      minutes: Math.max(1, Number(minutes) || 10),
      tags,
      ingredients: cleanIngredients,
      steps: cleanSteps,
      nutrition: nutritionPayload,
      sourceType: 'user' as const,
      authorNote: authorNote.trim() || undefined,
    }

    const validation = safeParseRecipe(draft)
    if (!validation.success) {
      setError(`请检查填写内容：${formatRecipeIssues(validation.error).join('；')}`)
      return
    }

    setSubmitting(true)
    try {
      const token = await getAccessToken()
      if (!token) throw new Error('登录状态已失效，请重新登录')

      const res = await fetch('/api/recipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ recipe: validation.data, derivedFrom: derivedFromId }),
      })
      const body = (await res.json()) as { ok?: boolean; recipeId?: string; error?: string }
      if (!res.ok || !body.ok || !body.recipeId) {
        throw new Error(body.error ?? '发布失败')
      }

      router.push(`/recipes/${encodeURIComponent(body.recipeId)}`)
      router.refresh()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {derivedFromId && parentTitle && (
        <div className="rounded-xl bg-tint-soft p-3.5 text-[13px] leading-5 text-tint-deep">
          ✍️ 正在改编《<strong>{parentTitle}</strong>》，原作保持不变，你的修改将作为全新菜谱发布并保留改编溯源。
        </div>
      )}

      {/* 基础信息 */}
      <section className="card p-4 space-y-3">
        <div>
          <label className="mb-1 block text-[12px] font-medium text-ink-3">菜名 *</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="如：少油版回锅肉"
            maxLength={80}
            className="field font-semibold"
            required
          />
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="mb-1 block text-center text-[11px] text-ink-3">几人份</label>
            <input
              type="number"
              min={1}
              max={20}
              value={servings}
              onChange={(e) => setServings(Number(e.target.value) || 2)}
              className="field text-center"
            />
          </div>
          <div>
            <label className="mb-1 block text-center text-[11px] text-ink-3">难度 (1-5)</label>
            <input
              type="number"
              min={1}
              max={5}
              value={difficulty}
              onChange={(e) => setDifficulty(Number(e.target.value) || 2)}
              className="field text-center"
            />
          </div>
          <div>
            <label className="mb-1 block text-center text-[11px] text-ink-3">耗时 (分钟) *</label>
            <input
              type="number"
              min={1}
              value={minutes}
              onChange={(e) => setMinutes(Number(e.target.value) || 20)}
              className="field text-center"
              required
            />
          </div>
        </div>

        {/* 标签 */}
        <div>
          <label className="mb-1 block text-[11px] text-ink-3">标签（回车添加）</label>
          <div className="mb-1.5 flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => removeTag(tag)}
                className="chip chip-on text-[12px]"
              >
                {tag} <span className="opacity-70">×</span>
              </button>
            ))}
          </div>
          <input
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault()
                addTag(tagInput)
              }
            }}
            placeholder="输入标签按回车，如：减脂、快手"
            className="field text-[13px]"
          />
        </div>
      </section>

      {/* 食材表 */}
      <section className="card p-4 space-y-2.5">
        <div className="flex items-center justify-between">
          <h2 className="text-[13px] font-medium text-ink-3">食材清单 *</h2>
          <button type="button" onClick={addIngredient} className="flex items-center gap-0.5 text-[13px] font-semibold text-tint">
            <IconPlus className="size-3.5" /> 加一行
          </button>
        </div>

        <div className="space-y-2">
          {ingredients.map((item, index) => (
            <div key={index} className="flex items-center gap-1.5">
              <input
                type="text"
                value={item.name}
                onChange={(e) => updateIngredient(index, { name: e.target.value })}
                placeholder="食材名称（如：西红柿）"
                className="field flex-2 text-[13px]"
                required={index === 0}
              />
              <input
                type="number"
                step="any"
                value={item.qty ?? ''}
                onChange={(e) => updateIngredient(index, { qty: e.target.value ? Number(e.target.value) : undefined })}
                placeholder="数量"
                className="field w-16 text-center text-[13px]"
              />
              <input
                type="text"
                value={item.unit ?? ''}
                onChange={(e) => updateIngredient(index, { unit: e.target.value || undefined })}
                placeholder="单位"
                className="field w-14 text-center text-[13px]"
              />
              <label className="flex shrink-0 items-center gap-1 text-[11px] text-ink-3">
                <input
                  type="checkbox"
                  checked={Boolean(item.optional)}
                  onChange={(e) => updateIngredient(index, { optional: e.target.checked })}
                  className="rounded"
                />
                可选
              </label>
              {ingredients.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeIngredient(index)}
                  className="p-1 text-ink-3 hover:text-danger"
                >
                  <IconX className="size-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* 做法步骤 */}
      <section className="card p-4 space-y-2.5">
        <div className="flex items-center justify-between">
          <h2 className="text-[13px] font-medium text-ink-3">做法步骤 *</h2>
          <button type="button" onClick={addStep} className="flex items-center gap-0.5 text-[13px] font-semibold text-tint">
            <IconPlus className="size-3.5" /> 加一步
          </button>
        </div>

        <div className="space-y-2">
          {steps.map((step, index) => (
            <div key={index} className="flex gap-2">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-tint text-[11px] font-bold text-white">
                {index + 1}
              </span>
              <textarea
                value={step.text}
                onChange={(e) => updateStep(index, e.target.value)}
                placeholder={`第 ${index + 1} 步详细做法`}
                rows={2}
                className="field min-w-0 flex-1 text-[13px] leading-5"
                required={index === 0}
              />
              {steps.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeStep(index)}
                  className="self-start p-1 text-ink-3 hover:text-danger"
                >
                  <IconX className="size-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* 营养参考 */}
      <section className="card p-4 space-y-2.5">
        <div className="flex items-center justify-between">
          <h2 className="text-[13px] font-medium text-ink-3">营养参考（每人份估算，选填）</h2>
        </div>
        <div className="grid grid-cols-4 gap-2">
          <div>
            <label className="mb-1 block text-center text-[10px] text-ink-3">热量 kcal</label>
            <input
              type="number"
              min={0}
              value={calories}
              onChange={(e) => setCalories(e.target.value)}
              placeholder="200"
              className="field text-center text-[12px]"
            />
          </div>
          <div>
            <label className="mb-1 block text-center text-[10px] text-ink-3">蛋白质 g</label>
            <input
              type="number"
              min={0}
              value={protein}
              onChange={(e) => setProtein(e.target.value)}
              placeholder="12"
              className="field text-center text-[12px]"
            />
          </div>
          <div>
            <label className="mb-1 block text-center text-[10px] text-ink-3">脂肪 g</label>
            <input
              type="number"
              min={0}
              value={fat}
              onChange={(e) => setFat(e.target.value)}
              placeholder="8"
              className="field text-center text-[12px]"
            />
          </div>
          <div>
            <label className="mb-1 block text-center text-[10px] text-ink-3">碳水 g</label>
            <input
              type="number"
              min={0}
              value={carbs}
              onChange={(e) => setCarbs(e.target.value)}
              placeholder="15"
              className="field text-center text-[12px]"
            />
          </div>
        </div>
      </section>

      {/* 心得 / 备注 */}
      <section className="card p-4 space-y-2">
        <label className="block text-[13px] font-medium text-ink-3">
          {derivedFromId ? '改编心得 / 调整说明' : '作者小贴士（选填）'}
        </label>
        <textarea
          value={authorNote}
          onChange={(e) => setAuthorNote(e.target.value)}
          placeholder={derivedFromId ? '例如：少放了一半油，加了一点陈醋更爽口' : '例如：火候一定要大，蛋液凝固立刻盛出'}
          rows={2}
          maxLength={500}
          className="field text-[13px] leading-5"
        />
      </section>

      {error && <p className="card p-3 text-[12px] leading-5 text-danger bg-danger-soft">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="btn-primary"
      >
        {submitting ? '发布中…' : derivedFromId ? '发布我的改编版' : '发布自建菜谱'}
      </button>
    </form>
  )
}
