import Link from 'next/link'
import { notFound } from 'next/navigation'

import { SAMPLE_RECIPES, type RecipeV1 } from '@kaifan/shared'

import { RecipeDetailInteractive } from '@/components/recipe-detail-interactive'
import { NavBar } from '@/components/ui'
import { createServerClient, isSupabaseConfigured } from '@/lib/supabase'

interface IngredientRow {
  qty: number | null
  unit: string | null
  optional: boolean
  ingredients: { name: string } | null
}

interface StepLike {
  text?: string
  durationMinutes?: number
}

async function fetchRecipe(
  id: string,
): Promise<{ recipe: RecipeV1; meta: { id: string; derivedFromId: string | null; derivedFromTitle: string | null } } | null> {
  if (!isSupabaseConfigured()) return null

  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('recipes')
    .select(
      'id, title, cover_url, servings, difficulty, minutes, tags, nutrition, steps, source_type, source_url, ai_generated, derived_from, author_note, recipe_ingredients(qty, unit, optional, ingredients(name))',
    )
    .eq('id', id)
    .eq('status', 'published')
    .is('deleted_at', null)
    .maybeSingle()

  if (error || !data) return null

  const row = data as unknown as {
    id: string
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
    derived_from: string | null
    author_note: string | null
    recipe_ingredients: IngredientRow[]
  }

  let derivedFromTitle: string | null = null
  if (row.derived_from) {
    const { data: parent } = await supabase
      .from('recipes')
      .select('title')
      .eq('id', row.derived_from)
      .maybeSingle()
    derivedFromTitle = (parent as { title?: string } | null)?.title ?? null
  }

  return {
    recipe: {
      schemaVersion: 'recipe.v1' as const,
      title: row.title,
      cover: row.cover_url ?? undefined,
      servings: row.servings,
      difficulty: row.difficulty,
      minutes: row.minutes,
      tags: row.tags ?? [],
      ingredients: row.recipe_ingredients.map((item) => ({
        name: item.ingredients?.name ?? '',
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
      authorNote: row.author_note ?? (row.ai_generated ? 'AI 生成，仅供参考' : undefined),
    },
    meta: {
      id: row.id,
      derivedFromId: row.derived_from,
      derivedFromTitle,
    },
  }
}

export default async function RecipeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const decodedId = decodeURIComponent(id)

  const dbData = await fetchRecipe(decodedId)
  const sample = SAMPLE_RECIPES.find((s) => s.title === decodedId)

  const recipe: RecipeV1 | null = dbData?.recipe ?? sample ?? null
  if (!recipe) notFound()

  return (
    <div className="screen">
      <NavBar title={recipe.title} back="/recipes" backLabel="菜谱" />

      {/* 封面图 / 极简标题区 */}
      {recipe.cover ? (
        <div className="mt-3 overflow-hidden rounded-xl bg-fill">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={recipe.cover}
            alt={recipe.title}
            className="h-52 w-full object-cover"
            loading="lazy"
          />
        </div>
      ) : null}

      <div className="mt-4 px-1">
        <h1 className="text-[24px] leading-tight font-bold tracking-tight text-ink">{recipe.title}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-ink-2">
          <span>⏱ {recipe.minutes} 分钟</span>
          <span>· 份量 {recipe.servings} 人份</span>
          <span>· 难度 {'★'.repeat(recipe.difficulty)}</span>
        </div>
        {recipe.tags.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {recipe.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-md bg-fill px-2 py-0.5 text-[12px] font-medium text-ink-2"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* 交互区：食材勾选、步骤进度、营养、署名、改编 */}
      <div className="mt-6">
        <RecipeDetailInteractive
          recipe={recipe}
          recipeId={dbData?.meta.id}
          derivedFromId={dbData?.meta.derivedFromId}
          derivedFromTitle={dbData?.meta.derivedFromTitle}
        />
      </div>
    </div>
  )
}
