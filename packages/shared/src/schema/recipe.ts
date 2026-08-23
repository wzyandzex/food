import { z } from 'zod'

import { RECIPE_SOURCE_TYPES, type RecipeSourceType } from '../domain.ts'

/** 菜谱导入统一格式版本号 */
export const RECIPE_SCHEMA_VERSION = 'recipe.v1'

const ingredientItemSchema = z.object({
  name: z.string().min(1),
  qty: z.number().positive().optional(),
  unit: z.string().min(1).optional(),
  optional: z.boolean().default(false),
})

const stepSchema = z.object({
  text: z.string().min(1),
  image: z.string().url().optional(),
  durationMinutes: z.number().int().positive().optional(),
})

const nutritionSchema = z.object({
  calories: z.number().nonnegative().optional(),
  protein: z.number().nonnegative().optional(),
  carbs: z.number().nonnegative().optional(),
  fat: z.number().nonnegative().optional(),
})

export const recipeV1Schema = z.object({
  schemaVersion: z.literal(RECIPE_SCHEMA_VERSION).default(RECIPE_SCHEMA_VERSION),
  title: z.string().min(1).max(80),
  cover: z.string().url().optional(),
  servings: z.number().int().positive().default(2),
  /** 难度 1–5 */
  difficulty: z.number().int().min(1).max(5).default(2),
  minutes: z.number().int().positive(),
  tags: z.array(z.string().min(1)).default([]),
  ingredients: z.array(ingredientItemSchema).min(1),
  steps: z.array(stepSchema).min(1),
  nutrition: nutritionSchema.optional(),
  sourceType: z.enum(RECIPE_SOURCE_TYPES),
  sourceUrl: z.string().url().optional(),
  authorNote: z.string().max(500).optional(),
})

export interface RecipeIngredientV1 extends z.infer<typeof ingredientItemSchema> {}
export interface RecipeStepV1 extends z.infer<typeof stepSchema> {}
export interface RecipeNutritionV1 extends z.infer<typeof nutritionSchema> {}
export interface RecipeV1 extends z.infer<typeof recipeV1Schema> {}

/** 是否为 AI 生成来源（用于显著标注） */
export function isAiSource(sourceType: RecipeSourceType): boolean {
  return sourceType === 'llm'
}

/** 严格解析：数据不合法时抛出 ZodError，导入管线使用 */
export function parseRecipe(input: unknown): RecipeV1 {
  return recipeV1Schema.parse(input)
}

/** 宽松解析：返回带错误详情的结果，接口/表单校验使用 */
export function safeParseRecipe(input: unknown) {
  return recipeV1Schema.safeParse(input)
}

/** 把校验错误压成 "字段路径: 信息" 的字符串数组，供导入报告展示 */
export function formatRecipeIssues(error: z.ZodError): string[] {
  return error.issues.map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
}
