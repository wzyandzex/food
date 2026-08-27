import type { RecipeV1 } from '@kaifan/shared'
import { createServerClient } from '@/lib/supabase'

export interface SaveUserRecipeInput {
  recipe: RecipeV1
  userId: string
  derivedFrom?: string | null
}

export interface SaveUserRecipeResult {
  ok: boolean
  message: string
  recipeId?: string
}

/** 用户端写入自建/改编菜谱：
 *  写 recipes (status='published', source_type='user', author_id, derived_from)
 *  → 逐个 upsert ingredients
 *  → 写 recipe_ingredients 关联
 *  后置失败补偿回滚，避免孤儿数据（与 admin recipe-importer 同款三步事务）。 */
export async function saveUserRecipe(input: SaveUserRecipeInput): Promise<SaveUserRecipeResult> {
  const { recipe, userId, derivedFrom } = input
  const supabase = createServerClient()

  // 1. 插入菜谱
  const { data: recipeRow, error: recipeError } = await supabase
    .from('recipes')
    .insert({
      title: recipe.title,
      cover_url: recipe.cover ?? null,
      source_type: 'user',
      source_url: recipe.sourceUrl ?? null,
      author_id: userId,
      derived_from: derivedFrom || null,
      servings: recipe.servings,
      difficulty: recipe.difficulty,
      minutes: recipe.minutes,
      tags: recipe.tags,
      nutrition: recipe.nutrition ?? null,
      steps: recipe.steps,
      author_note: recipe.authorNote ?? null,
      ai_generated: false,
      status: 'published', // 亲友圈非商用：自建直接上架
    })
    .select('id')
    .single()

  if (recipeError || !recipeRow) {
    return { ok: false, message: `菜谱创建失败：${recipeError?.message ?? '未知错误'}` }
  }

  const recipeId = recipeRow.id as string

  // 2. 食材 upsert
  const ingredientIds: string[] = []
  for (const ingredient of recipe.ingredients) {
    const { data: ingredientRow, error: ingredientError } = await supabase
      .from('ingredients')
      .upsert({ name: ingredient.name }, { onConflict: 'name' })
      .select('id')
      .single()

    if (ingredientError || !ingredientRow) {
      await supabase.from('recipes').delete().eq('id', recipeId)
      return {
        ok: false,
        message: `食材「${ingredient.name}」处理失败：${ingredientError?.message ?? '未知错误'}`,
      }
    }
    ingredientIds.push(ingredientRow.id as string)
  }

  // 3. 关联关系
  const relations = recipe.ingredients.map((ingredient, index) => ({
    recipe_id: recipeId,
    ingredient_id: ingredientIds[index],
    qty: ingredient.qty ?? null,
    unit: ingredient.unit ?? null,
    optional: ingredient.optional,
  }))

  const { error: relationError } = await supabase.from('recipe_ingredients').insert(relations)
  if (relationError) {
    await supabase.from('recipes').delete().eq('id', recipeId)
    return { ok: false, message: `食材关联写入失败：${relationError.message}` }
  }

  return { ok: true, recipeId, message: derivedFrom ? '改编菜谱已发布！' : '自建菜谱已发布！' }
}
