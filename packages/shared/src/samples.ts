import { parseRecipe, type RecipeV1 } from './schema/recipe.ts'

import tomatoEgg from '../fixtures/tomato-egg.json' with { type: 'json' }
import twiceCookedPork from '../fixtures/twice-cooked-pork.json' with { type: 'json' }

/** 未配置数据库时的降级样例数据（M1 阶段用于无 Supabase 时预览） */
export const SAMPLE_RECIPES: RecipeV1[] = [tomatoEgg, twiceCookedPork].map((raw) => parseRecipe(raw))