import { z } from 'zod'

import { MEAL_TYPES } from '../domain.ts'

const uuid = z.string().uuid()

export const circleMealDishSchema = z.object({
  recipeId: uuid.nullable().optional(),
  title: z.string().trim().min(1).max(80),
  coverUrl: z.string().url().nullable().optional(),
  servings: z.number().int().positive().max(99).optional(),
})

export const circleMealMemoryInputSchema = z.object({
  sourceOrderSessionId: uuid.optional(),
  title: z.string().trim().min(1).max(80),
  mealDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  mealType: z.enum(MEAL_TYPES),
  attendeeIds: z.array(uuid).max(10).default([]),
  dishes: z.array(circleMealDishSchema).min(1).max(30),
  selectedPhotos: z.array(z.string().url()).max(8).default([]),
  sharedNote: z.string().trim().max(500).nullable().optional(),
  rating: z.number().int().min(1).max(5).nullable().optional(),
  publish: z.boolean().default(false),
})

export const circleMealCookSessionInputSchema = z.object({
  sourceCookSessionId: uuid,
  selectedDishIds: z.array(uuid).min(1).max(30),
  selectedPhotos: z.array(z.string().url()).max(8).default([]),
  title: z.string().trim().max(80).optional(),
  sharedNote: z.string().trim().max(300).nullable().optional(),
  rating: z.number().int().min(1).max(5).nullable().optional(),
  publish: z.boolean().default(true),
})

export const circleMealContributionInputSchema = z.object({
  sourceCookSessionId: uuid.optional(),
  dishes: z.array(circleMealDishSchema).max(30).default([]),
  photos: z.array(z.string().url()).max(8).default([]),
  sharedNote: z.string().trim().max(300).nullable().optional(),
  rating: z.number().int().min(1).max(5).nullable().optional(),
}).refine(
  (value) => value.dishes.length > 0 || value.photos.length > 0 || Boolean(value.sharedNote) || value.rating != null,
  { message: '至少分享一道菜、照片、短评或评分' },
)

export type CircleMealMemoryInput = z.infer<typeof circleMealMemoryInputSchema>
export type CircleMealCookSessionInput = z.infer<typeof circleMealCookSessionInputSchema>
export type CircleMealContributionInput = z.infer<typeof circleMealContributionInputSchema>

export function safeParseCircleMealMemory(input: unknown) {
  return circleMealMemoryInputSchema.safeParse(input)
}

export function safeParseCircleMealCookSession(input: unknown) {
  return circleMealCookSessionInputSchema.safeParse(input)
}

export function safeParseCircleMealContribution(input: unknown) {
  return circleMealContributionInputSchema.safeParse(input)
}
