export const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'supper'] as const
export type MealType = (typeof MEAL_TYPES)[number]

export const MEAL_TYPE_LABELS: Record<MealType, string> = {
  breakfast: '早餐',
  lunch: '午餐',
  dinner: '晚餐',
  supper: '夜宵',
}

/** 菜谱生命周期状态机 */
export const RECIPE_STATUSES = [
  'draft',
  'processing',
  'pending', // REVIEW_PENDING
  'approved',
  'published',
  'rejected',
  'offline',
  'archived',
  'failed',
] as const
export type RecipeStatus = (typeof RECIPE_STATUSES)[number]

export const RECIPE_STATUS_LABELS: Record<RecipeStatus, string> = {
  draft: '草稿',
  processing: '处理中',
  pending: '待审核',
  approved: '已审核',
  published: '已发布',
  rejected: '已驳回',
  offline: '已下架',
  archived: '已归档',
  failed: '失败',
}

/** 菜谱合法状态迁移定义与守卫 */
export const RECIPE_VALID_TRANSITIONS: Record<RecipeStatus, RecipeStatus[]> = {
  draft: ['processing', 'pending', 'archived'],
  processing: ['pending', 'failed', 'draft'],
  pending: ['approved', 'published', 'rejected', 'draft'],
  approved: ['published', 'rejected', 'archived'],
  published: ['offline', 'archived'],
  rejected: ['draft', 'pending', 'archived'],
  offline: ['published', 'archived', 'draft'],
  archived: ['draft'],
  failed: ['draft', 'processing'],
}

export function isValidRecipeTransition(from: RecipeStatus, to: RecipeStatus): boolean {
  return RECIPE_VALID_TRANSITIONS[from]?.includes(to) ?? false
}

/** 点单会话状态机：进行中 → 已截单 → 采购中(做饭) → 已完成 / 已取消 */
export const ORDER_SESSION_STATUSES = [
  'open',
  'closed',
  'shopping',
  'cooking',
  'done',
  'canceled',
] as const
export type OrderSessionStatus = (typeof ORDER_SESSION_STATUSES)[number]

export const ORDER_SESSION_STATUS_LABELS: Record<OrderSessionStatus, string> = {
  open: '进行中',
  closed: '已截单',
  shopping: '采购中',
  cooking: '做饭中',
  done: '已完成',
  canceled: '已取消',
}

export const ORDER_SESSION_VALID_TRANSITIONS: Record<OrderSessionStatus, OrderSessionStatus[]> = {
  open: ['closed', 'canceled'],
  closed: ['shopping', 'cooking', 'canceled', 'open'],
  shopping: ['cooking', 'done', 'canceled'],
  cooking: ['done', 'canceled'],
  done: [],
  canceled: [],
}

export function isValidOrderTransition(from: OrderSessionStatus, to: OrderSessionStatus): boolean {
  return ORDER_SESSION_VALID_TRANSITIONS[from]?.includes(to) ?? false
}

/** 做饭记录状态机 */
export const COOK_SESSION_STATUSES = ['planned', 'cooking', 'completed', 'archived'] as const
export type CookSessionStatus = (typeof COOK_SESSION_STATUSES)[number]

/** 异步导入任务状态机 */
export const IMPORT_JOB_STATUSES = [
  'pending',
  'running',
  'succeeded',
  'partial_success',
  'failed',
  'canceled',
] as const
export type ImportJobStatus = (typeof IMPORT_JOB_STATUSES)[number]

export const IMPORT_JOB_STATUS_LABELS: Record<ImportJobStatus, string> = {
  pending: '排队中',
  running: '运行中',
  succeeded: '全部成功',
  partial_success: '部分成功',
  failed: '失败',
  canceled: '已取消',
}

/** 异步任务错误类型 */
export const JOB_ERROR_CODES = [
  'RATE_LIMIT',
  'TIMEOUT',
  'NETWORK',
  'PROVIDER_ERROR',
  'INVALID_OUTPUT',
  'SCHEMA_ERROR',
  'PERMISSION',
  'CONTENT_ERROR',
  'SSRF_BLOCKED',
  'UNKNOWN',
] as const
export type JobErrorCode = (typeof JOB_ERROR_CODES)[number]

export const RECIPE_SOURCE_TYPES = [
  'manual',
  'json',
  'xlsx',
  'url',
  'llm',
  'llm_batch',
  'ocr',
  'open_data',
  'user',
] as const
export type RecipeSourceType = (typeof RECIPE_SOURCE_TYPES)[number]

/** 饭搭子群人数上限（PRD §4.6：2–10 人固定小圈子） */
export const CIRCLE_MAX_MEMBERS = 10

export const CIRCLE_MEMBER_ROLES = ['owner', 'member'] as const
export type CircleMemberRole = (typeof CIRCLE_MEMBER_ROLES)[number]

/** 菜谱完整历史快照（用于做饭记录与排餐，抗母本改动） */
export interface RecipeSnapshot {
  id?: string
  title: string
  coverUrl?: string | null
  servings: number
  difficulty: number
  minutes: number
  tags?: string[]
  ingredients: Array<{
    name: string
    qty?: number | null
    unit?: string | null
    optional?: boolean
  }>
  steps: Array<{
    step: number
    text: string
    tip?: string
    timerMinutes?: number
  }>
  nutrition?: {
    caloriesPerServing?: number
    proteinGrams?: number
    fatGrams?: number
    carbGrams?: number
  } | null
  version?: number
  snapshotAt: string
}

/** 匿名参与者模型 */
export interface OrderParticipant {
  id: string
  orderSessionId: string
  participantTokenHash: string
  nickname: string
  userId?: string | null
  createdAt: string
  updatedAt: string
  lastSeenAt: string
}

/** 异步导入任务模型 */
export interface ImportJob {
  id: string
  type: RecipeSourceType
  status: ImportJobStatus
  total: number
  completed: number
  succeeded: number
  failed: number
  payload: Record<string, unknown>
  resultSummary?: Record<string, unknown> | null
  errorSummary?: string | null
  createdBy?: string | null
  startedAt?: string | null
  completedAt?: string | null
  createdAt: string
  updatedAt: string
}

/** 异步导入任务子项明细 */
export interface ImportJobItem {
  id: string
  jobId: string
  input: Record<string, unknown>
  status: 'pending' | 'running' | 'succeeded' | 'failed' | 'canceled'
  attempt: number
  maxAttempts: number
  result?: Record<string, unknown> | null
  errorCode?: JobErrorCode | null
  errorMessage?: string | null
  recipeId?: string | null
  startedAt?: string | null
  completedAt?: string | null
  createdAt: string
  updatedAt: string
}

/** 管理端审计日志模型 */
export interface AdminAuditLog {
  id: string
  actorId?: string | null
  action: string
  resourceType: string
  resourceId?: string | null
  metadata: Record<string, unknown>
  ipAddress?: string | null
  userAgent?: string | null
  createdAt: string
}

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

/** 做饭统计看板聚合结果 */
export interface CookingStats {
  totals: {
    monthCount: number
    totalSessions: number
    totalDishes: number
    totalPhotos: number
    avgRating: number | null
    orderLinkedRatio: number | null
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
