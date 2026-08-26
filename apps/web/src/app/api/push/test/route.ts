import { NextResponse } from 'next/server'
import { createServerClient, getAuthUserId } from '@/lib/supabase'
import { sendNotificationToUser } from '@/lib/push-notifications'

/** 给当前登录用户发一条测试推送，验证 Web Push 链路连通性 */
export async function POST(request: Request) {
  const userId = await getAuthUserId(request)
  if (!userId) {
    return NextResponse.json({ error: '请先登录后再测试推送' }, { status: 401 })
  }

  try {
    const supabase = createServerClient()
    const result = await sendNotificationToUser(supabase, {
      userId,
      type: 'system',
      title: '🔔 开饭测试通知',
      body: '如果您看到这条系统通知，说明 Web Push 已成功开启！',
      url: '/notifications',
    })

    if (result.deliveredPushCount === 0 && result.clearedStaleCount === 0) {
      const hasSubs = await supabase
        .from('push_subscriptions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)

      if ((hasSubs.count ?? 0) === 0) {
        return NextResponse.json(
          { error: '当前设备尚未成功订阅推送，请先点击「开启系统推送」' },
          { status: 400 },
        )
      }
    }

    return NextResponse.json({
      ok: true,
      deliveredPushCount: result.deliveredPushCount,
      clearedStaleCount: result.clearedStaleCount,
    })
  } catch (err) {
    console.error('发送测试推送异常：', err)
    return NextResponse.json({ error: `系统异常：${(err as Error).message}` }, { status: 500 })
  }
}
