import Link from 'next/link'
import { notFound } from 'next/navigation'

import { SAMPLE_RECIPES, type RecipeV1 } from '@kaifan/shared'

import { RecipeDetailInteractive } from '@/components/recipe-detail-interactive'
import { createServerClient, isSupabaseConfigured } from '@/lib/supabase'

interface IngredientRow {
  qty: number | null
  unit: string | null
  optional: boolean
  // 多对一嵌入：recipe_ingredients.ingredient_id 是单值 FK，PostgREST 返回对象而非数组
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

  if (error) {
    console.error('菜谱详情查询失败：', error.message)
    return null
  }
  if (!data) return null

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

  // 若有改编来源，查一次父本标题做溯源展示
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
      tags: row.tags,
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
    <main className="mx-auto min-h-dvh w-full max-w-md px-5 pt-12 pb-10">
      <header className="mb-6">
        <Link href="/recipes" className="mb-2 inline-block text-sm text-ink/50">
          ← 返回菜谱市场
        </Link>

        {/* 成品封面图（PRD §4.2） */}
        {recipe.cover ? (
          <div className="mb-4 overflow-hidden rounded-2xl bg-neutral-100 shadow-sm">
            <img
              src={recipe.cover}
              alt={recipe.title}
              className="h-48 w-full object-cover"
              loading="lazy"
            />
          </div>
        ) : (
          <div className="mb-4 flex h-32 w-full items-center justify-center rounded-2xl bg-brand-soft/70 text-4xl">
            🍳
          </div>
        )}

        <h1 className="text-2xl font-bold">{recipe.title}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-ink/55">
          <span>⏱ {recipe.minutes} 分钟</span>
          <span>· 份量 {recipe.servings} 人份</span>
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

      {/* 交互区：食材勾选、步骤进度、营养、署名、改编按钮、溯源 */}
      <RecipeDetailInteractive
        recipe={recipe}
        recipeId={dbData?.meta.id}
        derivedFromId={dbData?.meta.derivedFromId}
        derivedFromTitle={dbData?.meta.derivedFromTitle}
      />
    </main>
  )
}
