import Link from 'next/link'
import { notFound } from 'next/navigation'
import { SAMPLE_RECIPES, type RecipeV1 } from '@kaifan/shared'
import { createServerClient, isSupabaseConfigured } from '@/lib/supabase'
import { RecipeEditorForm } from '@/components/recipe-editor-form'

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

async function fetchParentRecipe(id: string): Promise<{ recipe: RecipeV1; parentId: string } | null> {
  if (!isSupabaseConfigured()) {
    const sample = SAMPLE_RECIPES.find((s) => s.title === id)
    if (!sample) return null
    return { recipe: sample, parentId: id }
  }

  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('recipes')
    .select(
      'id, title, cover_url, servings, difficulty, minutes, tags, nutrition, steps, source_type, author_note, recipe_ingredients(qty, unit, optional, ingredients(name))',
    )
    .eq('id', id)
    .eq('status', 'published')
    .is('deleted_at', null)
    .maybeSingle()

  if (error || !data) {
    // 降级 sample
    const sample = SAMPLE_RECIPES.find((s) => s.title === id)
    return sample ? { recipe: sample, parentId: id } : null
  }

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
    author_note: string | null
    recipe_ingredients: IngredientRow[]
  }

  return {
    parentId: row.id,
    recipe: {
      schemaVersion: 'recipe.v1',
      title: `${row.title}（我的改编版）`,
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
      sourceType: 'user',
      authorNote: row.author_note ?? `改编自《${row.title}》：调整了用量与做法`,
    },
  }
}

export default async function ForkRecipePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const decodedId = decodeURIComponent(id)

  const parent = await fetchParentRecipe(decodedId)
  if (!parent) notFound()

  return (
    <main className="mx-auto min-h-dvh w-full max-w-md px-5 pt-10 pb-16">
      <header className="mb-5">
        <Link href={`/recipes/${encodeURIComponent(decodedId)}`} className="mb-1 inline-block text-xs text-ink/50">
          ← 返回原作
        </Link>
        <h1 className="text-xl font-bold">✍️ 改编菜谱</h1>
        <p className="text-xs text-ink/60">保留原作结构，按你的口味调整食材、步骤与心得</p>
      </header>

      <RecipeEditorForm
        initialRecipe={parent.recipe}
        derivedFromId={parent.parentId}
        parentTitle={parent.recipe.title.replace(/（我的改编版）$/, '')}
      />
    </main>
  )
}
