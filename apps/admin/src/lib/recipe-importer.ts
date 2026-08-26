import type { RecipeV1 } from '@kaifan/shared'

import { getAdminClient } from '@/lib/supabase'

export interface SaveRecipeOptions {
  /** 入库状态：两段式流程先写入 pending，人工在管理端确认后才置为 published（PRD §4.2） */
  status?: 'pending' | 'published' | 'draft'
}

export interface SaveRecipeResult {
  ok: boolean
  message: string
  recipeId?: string
}

/** 事务性写入单条 recipe.v1：写 recipes → upsert ingredients → 写 recipe_ingredients。
 *  若后置步骤失败，主动清理已插入的 recipe 记录，避免孤儿数据。 */
export async function saveRecipe(
  recipe: RecipeV1,
  options: SaveRecipeOptions = {},
): Promise<SaveRecipeResult> {
  const { status = 'pending' } = options
  const supabase = getAdminClient()

  // 1. 插入菜谱
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
      ai_generated: recipe.sourceType === 'llm' || recipe.sourceType === 'ocr',
      status,
    })
    .select('id')
    .single()

  if (recipeError || !recipeRow) {
    return { ok: false, message: `菜谱写入失败：${recipeError?.message ?? '未知错误'}` }
  }

  const recipeId = recipeRow.id as string

  // 2. 食材处理：逐个 upsert
  const ingredientIds: string[] = []
  for (const ingredient of recipe.ingredients) {
    const { data: ingredientRow, error: ingredientError } = await supabase
      .from('ingredients')
      .upsert({ name: ingredient.name }, { onConflict: 'name' })
      .select('id')
      .single()

    if (ingredientError || !ingredientRow) {
      // 补偿：清理已建的菜谱记录
      await supabase.from('recipes').delete().eq('id', recipeId)
      return {
        ok: false,
        message: `食材「${ingredient.name}」处理失败：${ingredientError?.message ?? '未知错误'}，已回滚`,
      }
    }
    ingredientIds.push(ingredientRow.id as string)
  }

  // 3. 关联关系
  if (recipe.ingredients.length > 0) {
    const relations = recipe.ingredients.map((ingredient, index) => ({
      recipe_id: recipeId,
      ingredient_id: ingredientIds[index],
      qty: ingredient.qty ?? null,
      unit: ingredient.unit ?? null,
      optional: ingredient.optional,
    }))

    const { error: relationError } = await supabase.from('recipe_ingredients').insert(relations)
    if (relationError) {
      // 补偿：级联删除会清理关系（若有），这里删 recipe
      await supabase.from('recipes').delete().eq('id', recipeId)
      return { ok: false, message: `食材关联写入失败：${relationError.message}，已回滚` }
    }
  }

  return {
    ok: true,
    message: status === 'pending' ? `已暂存「${recipe.title}」（待确认）` : `已发布「${recipe.title}」`,
    recipeId,
  }
}

/** 兼容别名：保留给旧调用方 */
export const importRecipe = saveRecipe
