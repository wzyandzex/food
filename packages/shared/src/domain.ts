export const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'supper'] as const
export type MealType = (typeof MEAL_TYPES)[number]

export const MEAL_TYPE_LABELS: Record<MealType, string> = {
  breakfast: '早餐',
  lunch: '午餐',
  dinner: '晚餐',
  supper: '夜宵',
}

/** 点单会话状态机：进行中 → 已截单 → 采购中(做饭) → 已完成 / 已取消 */
export const ORDER_SESSION_STATUSES = [
  'open',
  'closed',
  'cooking',
  'done',
  'canceled',
] as const
export type OrderSessionStatus = (typeof ORDER_SESSION_STATUSES)[number]

export const ORDER_SESSION_STATUS_LABELS: Record<OrderSessionStatus, string> = {
  open: '进行中',
  closed: '已截单',
  cooking: '采购中',
  done: '已完成',
  canceled: '已取消',
}

export const RECIPE_SOURCE_TYPES = [
  'manual',
  'json',
  'xlsx',
  'url',
  'llm',
  'ocr',
  'open_data',
  'user',
] as const
export type RecipeSourceType = (typeof RECIPE_SOURCE_TYPES)[number]
