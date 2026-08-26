import webpush from 'web-push'
import type { NotificationRow } from '@/types/notifications'

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:kaifan@example.com'

let vapidConfigured = false

function ensureVapid() {
  if (vapidConfigured) return true
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.error('未配置 VAPID 密钥（NEXT_PUBLIC_VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY），Web Push 不可用')
    return false
  }
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
  vapidConfigured = true
  return true
}

export interface SendNotificationInput {
  userId: string
  type: string
  title: string
  body: string
  url?: string
  payload?: Record<string, unknown>
}

export interface SendNotificationResult {
  notificationId?: string
  deliveredPushCount: number
  clearedStaleCount: number
}

/** 给单个用户发送通知：先写站内 notifications 表，再尽力推送 Web Push */
export async function sendNotificationToUser(
  supabase: ReturnType<typeof import('@/lib/supabase').createServerClient>,
  input: SendNotificationInput,
): Promise<SendNotificationResult> {
  // 1. 站内通知记录（保证一定留存）
  const { data: inserted, error: insertError } = await supabase
    .from('notifications')
    .insert({
      user_id: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      url: input.url ?? null,
      payload: input.payload ?? {},
    })
    .select('id')
    .single()

  if (insertError || !inserted) {
    console.error('写入站内通知失败：', insertError?.message)
    return { deliveredPushCount: 0, clearedStaleCount: 0 }
  }

  const notificationId = inserted.id as string

  // 2. 获取用户的所有有效 Push 订阅端点
  const { data: subs, error: subsError } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', input.userId)

  if (subsError || !subs || subs.length === 0) {
    return { notificationId, deliveredPushCount: 0, clearedStaleCount: 0 }
  }

  if (!ensureVapid()) {
    return { notificationId, deliveredPushCount: 0, clearedStaleCount: 0 }
  }

  const pushPayload = JSON.stringify({
    title: input.title,
    body: input.body,
    url: input.url ?? '/notifications',
    tag: input.type,
  })

  let delivered = 0
  const staleSubscriptionIds: string[] = []

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          },
          pushPayload,
        )
        delivered += 1
      } catch (err) {
        const statusCode = (err as { statusCode?: number }).statusCode
        // 端点失效或订阅过期，自动清理
        if (statusCode === 404 || statusCode === 410) {
          staleSubscriptionIds.push(sub.id)
        } else {
          console.error(`Push 发送失败（endpoint=${sub.endpoint}）：`, (err as Error).message)
        }
      }
    }),
  )

  // 批量清理过期订阅
  let cleared = 0
  if (staleSubscriptionIds.length > 0) {
    const { data: deleted } = await supabase
      .from('push_subscriptions')
      .delete()
      .in('id', staleSubscriptionIds)
      .select('id')
    cleared = deleted?.length ?? 0
  }

  return { notificationId, deliveredPushCount: delivered, clearedStaleCount: cleared }
}

export interface BatchSendResult {
  notifiedCount: number
  deliveredPushCount: number
}

/** 给一群用户批量发通知（圈子/点单参与者），fire-and-forget 场景友好 */
export async function sendNotificationToUsers(
  supabase: ReturnType<typeof import('@/lib/supabase').createServerClient>,
  userIds: string[],
  input: Omit<SendNotificationInput, 'userId'>,
): Promise<BatchSendResult> {
  const unique = Array.from(new Set(userIds)).filter(Boolean)
  if (unique.length === 0) return { notifiedCount: 0, deliveredPushCount: 0 }

  const results = await Promise.all(
    unique.map((userId) => sendNotificationToUser(supabase, { ...input, userId })),
  )

  return {
    notifiedCount: results.length,
    deliveredPushCount: results.reduce((sum, result) => sum + result.deliveredPushCount, 0),
  }
}
