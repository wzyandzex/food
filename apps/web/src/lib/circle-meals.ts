import type {
  CircleMealAttendee,
  CircleMealContribution,
  CircleMealDishSnapshot,
  CircleMealMemory,
  CircleMealSummary,
  MealType,
} from '@kaifan/shared'
import { createServerClient } from '@/lib/supabase'
import type { CircleAccess } from '@/lib/circle-access'

interface MemoryRow {
  id: string
  circle_id: string
  source_order_session_id: string | null
  source_cook_session_id: string | null
  created_by: string | null
  title: string
  meal_date: string
  meal_type: MealType
  status: CircleMealMemory['status']
  cover_url: string | null
  dishes: CircleMealDishSnapshot[]
  shared_note: string | null
  published_at: string | null
  created_at: string
  updated_at: string
}

interface AttendeeRow {
  memory_id: string
  user_id: string
  nickname_snapshot: string
}

interface ContributionRow {
  id: string
  memory_id: string
  user_id: string
  source_cook_session_id: string | null
  dishes: CircleMealDishSnapshot[]
  photos: string[]
  shared_note: string | null
  rating: number | null
  status: CircleMealContribution['status']
  created_at: string
  updated_at: string
  profiles: { nickname: string } | null
}

function asDishes(value: unknown): CircleMealDishSnapshot[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is CircleMealDishSnapshot => {
    if (!item || typeof item !== 'object') return false
    const row = item as Record<string, unknown>
    return typeof row.title === 'string' && row.title.trim().length > 0
  })
}

function toMemory(row: MemoryRow): CircleMealMemory {
  return {
    id: row.id,
    circleId: row.circle_id,
    sourceOrderSessionId: row.source_order_session_id,
    sourceCookSessionId: row.source_cook_session_id,
    createdBy: row.created_by ?? '',
    title: row.title,
    mealDate: row.meal_date,
    mealType: row.meal_type,
    status: row.status,
    coverUrl: row.cover_url,
    sharedNote: row.shared_note,
    dishes: asDishes(row.dishes),
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function toSummary(row: MemoryRow, attendeeCount: number, contributionCount: number): CircleMealSummary {
  return {
    id: row.id,
    sourceOrderSessionId: row.source_order_session_id,
    sourceCookSessionId: row.source_cook_session_id,
    title: row.title,
    mealDate: row.meal_date,
    mealType: row.meal_type,
    status: row.status,
    coverUrl: row.cover_url,
    dishCount: asDishes(row.dishes).length,
    attendeeCount,
    contributionCount,
    createdBy: row.created_by ?? '',
    publishedAt: row.published_at,
  }
}

function toAttendee(row: AttendeeRow, userId: string): CircleMealAttendee {
  return {
    memoryId: row.memory_id,
    userId: row.user_id,
    nickname: row.nickname_snapshot,
    isMe: row.user_id === userId,
  }
}

function toContribution(row: ContributionRow, userId: string): CircleMealContribution {
  return {
    id: row.id,
    memoryId: row.memory_id,
    userId: row.user_id,
    nickname: row.profiles?.nickname ?? '饭搭子',
    dishes: asDishes(row.dishes),
    photos: row.photos ?? [],
    sharedNote: row.shared_note,
    rating: row.rating,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    isMe: row.user_id === userId,
  }
}

export interface CircleMealDetail {
  memory: CircleMealMemory
  attendees: CircleMealAttendee[]
  contributions: CircleMealContribution[]
}

export async function listCircleMeals(access: CircleAccess): Promise<CircleMealSummary[]> {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('circle_meal_memories')
    .select('id, circle_id, source_order_session_id, source_cook_session_id, created_by, title, meal_date, meal_type, status, cover_url, dishes, shared_note, published_at, created_at, updated_at')
    .eq('circle_id', access.circleId)
    .or(`status.eq.published,created_by.eq.${access.userId}`)
    .order('meal_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) throw new Error(error.message)
  const rows = (data ?? []) as unknown as MemoryRow[]
  if (rows.length === 0) return []

  const ids = rows.map((row) => row.id)
  const [{ data: attendees, error: attendeesError }, { data: contributions, error: contributionsError }] =
    await Promise.all([
      supabase.from('circle_meal_attendees').select('memory_id').in('memory_id', ids),
      supabase.from('circle_meal_contributions').select('memory_id').eq('status', 'shared').in('memory_id', ids),
    ])

  if (attendeesError) throw new Error(attendeesError.message)
  if (contributionsError) throw new Error(contributionsError.message)

  const attendeeCounts = new Map<string, number>()
  for (const row of (attendees ?? []) as Array<{ memory_id: string }>) {
    attendeeCounts.set(row.memory_id, (attendeeCounts.get(row.memory_id) ?? 0) + 1)
  }
  const contributionCounts = new Map<string, number>()
  for (const row of (contributions ?? []) as Array<{ memory_id: string }>) {
    contributionCounts.set(row.memory_id, (contributionCounts.get(row.memory_id) ?? 0) + 1)
  }

  return rows.map((row) => toSummary(row, attendeeCounts.get(row.id) ?? 0, contributionCounts.get(row.id) ?? 0))
}

export async function getCircleMeal(access: CircleAccess, memoryId: string): Promise<CircleMealDetail | null> {
  const supabase = createServerClient()
  const { data: memoryData, error: memoryError } = await supabase
    .from('circle_meal_memories')
    .select('id, circle_id, source_order_session_id, source_cook_session_id, created_by, title, meal_date, meal_type, status, cover_url, dishes, shared_note, published_at, created_at, updated_at')
    .eq('id', memoryId)
    .eq('circle_id', access.circleId)
    .maybeSingle()

  if (memoryError) throw new Error(memoryError.message)
  if (!memoryData) return null
  const memory = toMemory(memoryData as unknown as MemoryRow)
  if (memory.status !== 'published' && memory.createdBy !== access.userId) return null

  const [{ data: attendeeData, error: attendeeError }, { data: contributionData, error: contributionError }] =
    await Promise.all([
      supabase.from('circle_meal_attendees').select('memory_id, user_id, nickname_snapshot').eq('memory_id', memoryId).order('created_at', { ascending: true }),
      supabase
        .from('circle_meal_contributions')
        .select('id, memory_id, user_id, source_cook_session_id, dishes, photos, shared_note, rating, status, created_at, updated_at, profiles(nickname)')
        .eq('memory_id', memoryId)
        .eq('status', 'shared')
        .order('created_at', { ascending: true }),
    ])

  if (attendeeError) throw new Error(attendeeError.message)
  if (contributionError) throw new Error(contributionError.message)

  return {
    memory,
    attendees: ((attendeeData ?? []) as unknown as AttendeeRow[]).map((row) => toAttendee(row, access.userId)),
    contributions: ((contributionData ?? []) as unknown as ContributionRow[]).map((row) => toContribution(row, access.userId)),
  }
}

interface OrderItem {
  recipeId?: string
  freeText?: string
  servings?: number
}

async function buildDishesFromOrder(
  supabase: ReturnType<typeof createServerClient>,
  orderId: string,
): Promise<CircleMealDishSnapshot[]> {
  const { data: entries, error } = await supabase
    .from('order_entries')
    .select('items')
    .eq('order_session_id', orderId)
  if (error) throw new Error(error.message)

  const items = ((entries ?? []) as Array<{ items: OrderItem[] | null }>).flatMap((entry) => entry.items ?? [])
  const recipeIds = Array.from(new Set(items.map((item) => item.recipeId).filter((id): id is string => Boolean(id))))
  const titles = new Map<string, string>()
  if (recipeIds.length > 0) {
    const { data: recipes, error: recipeError } = await supabase.from('recipes').select('id, title, cover_url').in('id', recipeIds)
    if (recipeError) throw new Error(recipeError.message)
    for (const recipe of (recipes ?? []) as Array<{ id: string; title: string; cover_url: string | null }>) {
      titles.set(recipe.id, recipe.title)
    }
  }

  const dishes: CircleMealDishSnapshot[] = []
  const seen = new Set<string>()
  for (const item of items) {
    const title = item.freeText?.trim() || (item.recipeId ? titles.get(item.recipeId) : undefined) || '未命名菜品'
    const key = `${item.recipeId ?? 'free'}:${title}`
    if (seen.has(key)) continue
    seen.add(key)
    dishes.push({ recipeId: item.recipeId ?? null, title, servings: item.servings ?? 1 })
  }
  return dishes
}

export interface CreateCircleMealFromOrderInput {
  sourceOrderSessionId: string
  title?: string
  mealDate?: string
  mealType?: MealType
  attendeeIds?: string[]
  sharedNote?: string | null
  rating?: number | null
  publish?: boolean
}

async function deleteMemoryAfterSetupFailure(
  supabase: ReturnType<typeof createServerClient>,
  memoryId: string,
): Promise<void> {
  const { error } = await supabase.from('circle_meal_memories').delete().eq('id', memoryId)
  if (error) console.error('清理未完成餐桌档案失败：', error.message)
}

export async function createCircleMealFromOrder(
  access: CircleAccess,
  input: CreateCircleMealFromOrderInput,
): Promise<CircleMealDetail> {
  const supabase = createServerClient()
  const { data: existing, error: existingError } = await supabase
    .from('circle_meal_memories')
    .select('id')
    .eq('circle_id', access.circleId)
    .eq('source_order_session_id', input.sourceOrderSessionId)
    .maybeSingle()
  if (existingError) throw new Error(existingError.message)
  if (existing?.id) {
    const detail = await getCircleMeal(access, existing.id as string)
    if (detail) return detail
    throw new Error('这场点单已经收进餐桌档案')
  }

  const { data: order, error: orderError } = await supabase
    .from('order_sessions')
    .select('id, circle_id, title, status, created_at')
    .eq('id', input.sourceOrderSessionId)
    .maybeSingle()
  if (orderError) throw new Error(orderError.message)
  if (!order || order.circle_id !== access.circleId) throw new Error('这场点单不属于这个圈子')
  if (order.status !== 'done') throw new Error('这顿饭还在进行中，做完后再收档')

  const dishes = await buildDishesFromOrder(supabase, input.sourceOrderSessionId)
  if (dishes.length === 0) throw new Error('这场点单还没有可收档的菜品')

  const mealDate = input.mealDate ?? String(order.created_at).slice(0, 10)
  const mealType = input.mealType ?? 'dinner'
  const status = input.publish ? 'published' : 'draft'
  const now = new Date().toISOString()
  const { data: created, error: createError } = await supabase
    .from('circle_meal_memories')
    .insert({
      circle_id: access.circleId,
      source_order_session_id: input.sourceOrderSessionId,
      created_by: access.userId,
      title: input.title?.trim() || order.title,
      meal_date: mealDate,
      meal_type: mealType,
      status,
      dishes,
      shared_note: input.sharedNote ?? null,
      published_at: status === 'published' ? now : null,
      updated_at: now,
    })
    .select('id')
    .single()
  if (createError || !created) throw new Error(createError?.message ?? '餐桌档案创建失败')

  try {
    await addAttendees(supabase, access, created.id as string, input.attendeeIds ?? [])
  } catch (error) {
    await deleteMemoryAfterSetupFailure(supabase, created.id as string)
    throw error
  }
  if (status === 'published') await notifyMemoryPublished(supabase, access, created.id as string, order.title)

  const detail = await getCircleMeal(access, created.id as string)
  if (!detail) throw new Error('餐桌档案创建后无法读取')
  return detail
}

export async function addAttendees(
  supabase: ReturnType<typeof createServerClient>,
  access: CircleAccess,
  memoryId: string,
  attendeeIds: string[],
): Promise<void> {
  const ids = Array.from(new Set([access.userId, ...attendeeIds])).slice(0, 10)
  if (ids.length === 0) return
  const { data: members, error: membersError } = await supabase
    .from('circle_members')
    .select('user_id, profiles(nickname)')
    .eq('circle_id', access.circleId)
    .in('user_id', ids)
  if (membersError) throw new Error(membersError.message)

  const rows = ((members ?? []) as unknown as Array<{ user_id: string; profiles: { nickname: string } | null }>).map((member) => ({
    memory_id: memoryId,
    user_id: member.user_id,
    nickname_snapshot: member.profiles?.nickname ?? '饭搭子',
    added_by: access.userId,
  }))
  if (rows.length === 0) return
  const { error } = await supabase.from('circle_meal_attendees').upsert(rows, { onConflict: 'memory_id,user_id' })
  if (error) throw new Error(error.message)
}

async function notifyMemoryPublished(
  supabase: ReturnType<typeof createServerClient>,
  access: CircleAccess,
  memoryId: string,
  title: string,
): Promise<void> {
  try {
    const { sendNotificationToUsers } = await import('@/lib/push-notifications')
    const { data: members } = await supabase.from('circle_members').select('user_id').eq('circle_id', access.circleId).neq('user_id', access.userId)
    await sendNotificationToUsers(
      supabase,
      ((members ?? []) as Array<{ user_id: string }>).map((member) => member.user_id),
      {
        type: 'circle_memory_published',
        title: `🍚 ${access.circle.name} 收进了一顿饭`,
        body: `「${title}」已经留在餐桌档案里`,
        url: `/circles/${access.circleId}/meals/${memoryId}`,
        payload: { circleId: access.circleId, memoryId },
      },
    )
  } catch (error) {
    console.error('餐桌档案通知失败：', error)
  }
}

export interface CreateCircleMealInput {
  title: string
  mealDate: string
  mealType: MealType
  dishes: CircleMealDishSnapshot[]
  attendeeIds?: string[]
  coverUrl?: string | null
  sharedNote?: string | null
  rating?: number | null
  selectedPhotos?: string[]
  sourceCookSessionId?: string
  publish?: boolean
}

export interface CreateCircleMealFromCookSessionInput {
  sourceCookSessionId: string
  selectedDishIds: string[]
  title?: string
  sharedNote?: string | null
  rating?: number | null
  selectedPhotos?: string[]
  publish?: boolean
}

interface CookSessionSourceRow {
  id: string
  user_id: string
  date: string
  meal_type: MealType
}

interface CookDishSourceRow {
  id: string
  snapshot_title: string
  snapshot_cover: string | null
  photos: string[] | null
}

/** 从当前用户的私密做饭记录复制显式选择的快照，不放宽 CookSession 的可见性。 */
export async function createCircleMealFromCookSession(
  access: CircleAccess,
  input: CreateCircleMealFromCookSessionInput,
): Promise<CircleMealDetail> {
  const supabase = createServerClient()
  const { data: existing, error: existingError } = await supabase
    .from('circle_meal_memories')
    .select('id')
    .eq('circle_id', access.circleId)
    .eq('source_cook_session_id', input.sourceCookSessionId)
    .maybeSingle()
  if (existingError) throw new Error(existingError.message)
  if (existing?.id) {
    const detail = await getCircleMeal(access, existing.id as string)
    if (detail) return detail
  }

  const { data: session, error: sessionError } = await supabase
    .from('cook_sessions')
    .select('id, user_id, date, meal_type')
    .eq('id', input.sourceCookSessionId)
    .eq('user_id', access.userId)
    .maybeSingle()
  if (sessionError) throw new Error(sessionError.message)
  if (!session) throw new Error('只能分享自己的做饭记录')

  const sourceSession = session as unknown as CookSessionSourceRow
  const { data: dishData, error: dishError } = await supabase
    .from('cook_dishes')
    .select('id, snapshot_title, snapshot_cover, photos')
    .eq('session_id', sourceSession.id)
  if (dishError) throw new Error(dishError.message)

  const selectedIds = new Set(input.selectedDishIds)
  const selectedDishes = ((dishData ?? []) as unknown as CookDishSourceRow[]).filter((dish) => selectedIds.has(dish.id))
  if (selectedDishes.length === 0) throw new Error('至少选择一道要分享的菜')

  const selectedPhotos = Array.from(new Set(input.selectedPhotos ?? []))
    .filter((photo) => selectedDishes.some((dish) => (dish.photos ?? []).includes(photo)))
    .slice(0, 8)
  const dishes = selectedDishes.map((dish) => ({
    title: dish.snapshot_title,
    coverUrl: dish.snapshot_cover,
  }))
  const status = input.publish ? 'published' : 'draft'
  const now = new Date().toISOString()
  const sharedTitle = input.title?.trim() || `${sourceSession.date} 的${sourceSession.meal_type === 'dinner' ? '晚餐' : '一顿饭'}`
  const { data: created, error: createError } = await supabase
    .from('circle_meal_memories')
    .insert({
      circle_id: access.circleId,
      source_cook_session_id: sourceSession.id,
      created_by: access.userId,
      title: sharedTitle,
      meal_date: sourceSession.date,
      meal_type: sourceSession.meal_type,
      status,
      cover_url: selectedPhotos[0] ?? dishes[0]?.coverUrl ?? null,
      dishes,
      shared_note: input.sharedNote ?? null,
      published_at: status === 'published' ? now : null,
      updated_at: now,
    })
    .select('id')
    .single()
  if (createError || !created) throw new Error(createError?.message ?? '餐桌档案创建失败')

  const memoryId = created.id as string
  try {
    await addAttendees(supabase, access, memoryId, [])
    const { error: contributionError } = await supabase
      .from('circle_meal_contributions')
      .insert({
        memory_id: memoryId,
        user_id: access.userId,
        source_cook_session_id: sourceSession.id,
        dishes,
        photos: selectedPhotos,
        shared_note: input.sharedNote ?? null,
        rating: input.rating ?? null,
        status: 'shared',
        updated_at: now,
      })
    if (contributionError) throw new Error(contributionError.message)
  } catch (error) {
    await deleteMemoryAfterSetupFailure(supabase, memoryId)
    throw error
  }

  if (status === 'published') await notifyMemoryPublished(supabase, access, memoryId, sharedTitle)
  const detail = await getCircleMeal(access, memoryId)
  if (!detail) throw new Error('餐桌档案创建后无法读取')
  return detail
}

export async function createCircleMeal(access: CircleAccess, input: CreateCircleMealInput): Promise<CircleMealDetail> {
  const supabase = createServerClient()
  const status = input.publish ? 'published' : 'draft'
  const now = new Date().toISOString()
  const { data: created, error } = await supabase
    .from('circle_meal_memories')
    .insert({
      circle_id: access.circleId,
      created_by: access.userId,
      title: input.title.trim(),
      meal_date: input.mealDate,
      meal_type: input.mealType,
      status,
      cover_url: input.coverUrl ?? input.selectedPhotos?.[0] ?? null,
      dishes: input.dishes,
      shared_note: input.sharedNote ?? null,
      published_at: status === 'published' ? now : null,
      updated_at: now,
    })
    .select('id')
    .single()
  if (error || !created) throw new Error(error?.message ?? '餐桌档案创建失败')

  try {
    await addAttendees(supabase, access, created.id as string, input.attendeeIds ?? [])
  } catch (setupError) {
    await deleteMemoryAfterSetupFailure(supabase, created.id as string)
    throw setupError
  }
  if (status === 'published') await notifyMemoryPublished(supabase, access, created.id as string, input.title)
  const detail = await getCircleMeal(access, created.id as string)
  if (!detail) throw new Error('餐桌档案创建后无法读取')
  return detail
}

export async function changeCircleMealStatus(
  access: CircleAccess,
  memoryId: string,
  status: 'published' | 'withdrawn',
): Promise<CircleMealDetail | null> {
  const supabase = createServerClient()
  const { data: memory, error: readError } = await supabase
    .from('circle_meal_memories')
    .select('id, status, created_by, title')
    .eq('id', memoryId)
    .eq('circle_id', access.circleId)
    .maybeSingle()
  if (readError) throw new Error(readError.message)
  if (!memory) return null
  if (memory.created_by !== access.userId && access.role !== 'owner') throw new Error('只有档案创建者或群主可以管理这顿饭')
  if (status === 'published' && memory.status !== 'draft') throw new Error('只有整理中的档案可以发布')
  if (status === 'withdrawn' && !['draft', 'published'].includes(memory.status as string)) throw new Error('这条档案已经撤回')

  const { error: updateError } = await supabase
    .from('circle_meal_memories')
    .update({ status, published_at: status === 'published' ? new Date().toISOString() : null, updated_at: new Date().toISOString() })
    .eq('id', memoryId)
  if (updateError) throw new Error(updateError.message)

  if (status === 'published') await notifyMemoryPublished(supabase, access, memoryId, memory.title as string)
  return getCircleMeal(access, memoryId)
}

export interface AddContributionInput {
  dishes?: CircleMealDishSnapshot[]
  photos?: string[]
  sharedNote?: string | null
  rating?: number | null
  sourceCookSessionId?: string
}

export async function addContribution(
  access: CircleAccess,
  memoryId: string,
  input: AddContributionInput,
): Promise<CircleMealContribution> {
  const supabase = createServerClient()
  const detail = await getCircleMeal(access, memoryId)
  if (!detail || detail.memory.status !== 'published') throw new Error('这条餐桌档案不存在或尚未发布')

  const { data, error } = await supabase
    .from('circle_meal_contributions')
    .upsert(
      {
        memory_id: memoryId,
        user_id: access.userId,
        source_cook_session_id: input.sourceCookSessionId ?? null,
        dishes: input.dishes ?? [],
        photos: input.photos ?? [],
        shared_note: input.sharedNote ?? null,
        rating: input.rating ?? null,
        status: 'shared',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'memory_id,user_id' },
    )
    .select('id, memory_id, user_id, source_cook_session_id, dishes, photos, shared_note, rating, status, created_at, updated_at, profiles(nickname)')
    .single()
  if (error || !data) throw new Error(error?.message ?? '保存贡献失败')
  return toContribution(data as unknown as ContributionRow, access.userId)
}

export async function deleteContribution(access: CircleAccess, memoryId: string, contributionId: string): Promise<void> {
  const supabase = createServerClient()
  const { error } = await supabase
    .from('circle_meal_contributions')
    .update({ status: 'withdrawn', updated_at: new Date().toISOString() })
    .eq('id', contributionId)
    .eq('memory_id', memoryId)
    .eq('user_id', access.userId)
  if (error) throw new Error(error.message)
}
