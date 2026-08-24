import Link from 'next/link'
import { notFound } from 'next/navigation'

import { SAMPLE_RECIPES, type RecipeV1 } from '@kaifan/shared'

import { createServerClient } from '@/lib/supabase'

interface IngredientRow {
  qty: number | null
  unit: string | null
  optional: boolean
  ingredients: { name: string }[] | null
}

interface StepLike {
  text?: string
  durationMinutes?: number
}

async function fetchRecipe(id: string): Promise<RecipeV1 | null> {
  try {
    const supabase = createServerClient()
    const { data, error } = await supabase
      .from('recipes')
      .select(
        'title, cover_url, servings, difficulty, minutes, tags, nutrition, steps, source_type, source_url, ai_generated, recipe_ingredients(qty, unit, optional, ingredients(name))',
      )
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (error || !data) return null

    const row = data as {
      title: string
      cover_url: string | null
      servings: number
      difficulty: number
      minutes: number
      tags: string[]
      nutrition: Record<string, number> | null
      steps: StepLike[]
      source_type: string
      source_url: string | null
      ai_generated: boolean
      recipe_ingredients: IngredientRow[]
    }

    return {
      schemaVersion: 'recipe.v1' as const,
      title: row.title,
      cover: row.cover_url ?? undefined,
      servings: row.servings,
      difficulty: row.difficulty,
      minutes: row.minutes,
      tags: row.tags,
      ingredients: row.recipe_ingredients.map((item) => ({
        name: item.ingredients?.[0]?.name ?? '',
        qty: item.qty ?? undefined,
        unit: item.unit ?? undefined,
        optional: item.optional,
      })),
      steps: row.steps.map((step, index) => ({
        text: step.text ?? `步骤 ${index + 1}`,
        durationMinutes: step.durationMinutes,
      })),
      nutrition: row.nutrition ?? undefined,
      sourceType: row.source_type as RecipeV1['sourceType'],
      sourceUrl: row.source_url ?? undefined,
      authorNote: row.ai_generated ? 'AI 生成，仅供参考' : undefined,
    }
  } catch {
    return null
  }
}

export default async function RecipeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const decodedId = decodeURIComponent(id)

  const recipe = (await fetchRecipe(decodedId)) ??
    SAMPLE_RECIPES.find((sample) => sample.title === decodedId) ??
    null

  if (!recipe) notFound()

  return (
    <main className="mx-auto min-h-dvh w-full max-w-md px-5 pt-12 pb-10">
      <header className="mb-6">
        <Link href="/recipes" className="mb-2 inline-block text-sm text-ink/50">
          ← 返回菜谱市场
        </Link>
        <h1 className="text-2xl font-bold">{recipe.title}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-ink/55">
          <span>⏱ {recipe.minutes} 分钟</span>
          <span>· 份量 {recipe.servings}</span>
          <span>· 难度 {'⭐'.repeat(recipe.difficulty)}</span>
        </div>
        {recipe.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {recipe.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-brand-soft px-2.5 py-0.5 text-xs text-brand-deep"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </header>

      <section className="mb-6 rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-3 font-semibold">食材</h2>
        <ul className="space-y-2 text-sm">
          {recipe.ingredients.map((ingredient, index) => (
            <li key={`${ingredient.name}-${index}`} className="flex justify-between">
              <span>
                {ingredient.name}
                {ingredient.optional && (
                  <span className="ml-1 text-xs text-ink/40">（可选）</span>
                )}
              </span>
              <span className="text-ink/55">
                {ingredient.qty != null ? `${ingredient.qty} ${ingredient.unit ?? ''}` : ''}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mb-6 rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-3 font-semibold">做法</h2>
        <ol className="space-y-3">
          {recipe.steps.map((step, index) => (
            <li key={index} className="flex gap-3 text-sm leading-6">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-semibold text-white">
                {index + 1}
              </span>
              <span>
                {step.text}
                {step.durationMinutes != null && (
                  <span className="ml-1 text-xs text-ink/40">
                    （约 {step.durationMinutes} 分钟）
                  </span>
                )}
              </span>
            </li>
          ))}
        </ol>
      </section>

      {recipe.authorNote && (
        <p className="rounded-xl bg-brand-soft px-4 py-3 text-xs text-ink/60">
          {recipe.authorNote}
        </p>
      )}
    </main>
  )
}