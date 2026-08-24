import type { RecipeV1 } from '@kaifan/shared'

import { getAdminClient } from '@/lib/supabase'

export interface ImportResult {
  ok: boolean
  message: string
  importedCount?: number
}

/** 把 recipe.v1 数据写入数据库：先查/建食材，再建菜谱，最后写食材关联 */
export async function importRecipe(recipe: RecipeV1): Promise<ImportResult> {
  const supabase = getAdminClient()

  // 1. 菜谱本身
  const { data: recipeRow, error: recipeError } = await supabase
    .from('recipes')
    .insert({
      title: recipe.title,
      cover_url: recipe.cover ?? null,
      source_type: recipe.sourceType,
      source_url: recipe.sourceUrl ?? null,
      servings: recipe.servings,
      difficulty: recipe.difficulty,
      minutes: recipe.minutes,
      tags: recipe.tags,
      nutrition: recipe.nutrition ?? null,
      steps: recipe.steps,
      ai_generated: recipe.sourceType === 'llm',
      status: 'published',
    })
    .select('id')
    .single()

  if (recipeError || !recipeRow) {
    return { ok: false, message: `菜谱写入失败：${recipeError?.message ?? '未知错误'}` }
  }

  const recipeId = recipeRow.id as string

  // 2. 食材：逐个 upsert，拿到 id
  const ingredientIds: string[] = []
  for (const ingredient of recipe.ingredients) {
    const { data: ingredientRow, error: ingredientError } = await supabase
      .from('ingredients')
      .upsert({ name: ingredient.name }, { onConflict: 'name' })
      .select('id')
      .single()

    if (ingredientError || !ingredientRow) {
      return {
        ok: false,
        message: `食材「${ingredient.name}」处理失败：${ingredientError?.message ?? '未知错误'}`,
      }
    }
    ingredientIds.push(ingredientRow.id as string)
  }

  // 3. 菜谱-食材关联
  const relations = recipe.ingredients.map((ingredient, index) => ({
    recipe_id: recipeId,
    ingredient_id: ingredientIds[index],
    qty: ingredient.qty ?? null,
    unit: ingredient.unit ?? null,
    optional: ingredient.optional,
  }))

  const { error: relationError } = await supabase.from('recipe_ingredients').insert(relations)
  if (relationError) {
    return { ok: false, message: `食材关联写入失败：${relationError.message}` }
  }

  return { ok: true, message: `已导入「${recipe.title}」`, importedCount: 1 }
}