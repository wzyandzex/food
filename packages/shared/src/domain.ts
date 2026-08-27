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

/** 饭搭子群人数上限（PRD §4.6：2–10 人固定小圈子） */
export const CIRCLE_MAX_MEMBERS = 10

export const CIRCLE_MEMBER_ROLES = ['owner', 'member'] as const
export type CircleMemberRole = (typeof CIRCLE_MEMBER_ROLES)[number]

/** 购物清单中的单项 */
export interface ShoppingListItem {
  id: string
  name: string
  qty?: number | null
  unit?: string | null
  checked: boolean
  sourceRecipeTitle?: string
}

/** 购物清单完整模型 */
export interface ShoppingListRecord {
  id: string
  ownerId: string
  sourceOrderSessionId?: string | null
  items: ShoppingListItem[]
  createdAt: string
  updatedAt: string
}

/** 做饭统计看板聚合结果（PRD §4.3 统计看板） */
export interface CookingStats {
  totals: {
    monthCount: number
    totalSessions: number
    totalDishes: number
    totalPhotos: number
    avgRating: number | null
    orderLinkedRatio: number | null
    /** 本月按菜谱每份估算的摄入热量（关联了菜谱且有营养数据的顿才计入） */
    monthCalories?: number | null
    totalCalories?: number | null
  }
  streaks: { currentStreakDays: number; longestStreakDays: number }
  newDishCount: number
  thisMonthNewDishes: number
  topDishes: Array<{ title: string; count: number; recipeId?: string }>
  mealTypeDist: Record<MealType, number>
  monthlyTrend: Array<{ month: string; sessions: number }>
}
