import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { sendNotificationToUser } from '@/lib/push-notifications'

/** 截单提醒定时任务（PRD §4.6 第三类事件：截单提醒）。
 *  由 GitHub Actions cron 每 15 分钟调用（见 .github/workflows/deadline-reminders.yml），
 *  对「status=open 且 60 分钟内截止且尚未提醒过」的会话，向发起人发站内+Push 双通道提醒。 */
export async function GET(request: Request) {
  // 防滥用：仅持有 CRON_SECRET 的调度方可以触发
  const header = request.headers.get('authorization') ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
  const secret = process.env.CRON_SECRET
  if (!secret || token !== secret) {
    return NextResponse.json({ error: '未授权' }, { status: 401 })
  }

  try {
    const supabase = createServerClient()

    const now = new Date()
    const until = new Date(now.getTime() + 60 * 60 * 1000)

    const { data: sessions, error } = await supabase
      .from('order_sessions')
      .select('id, host_id, title, deadline')
      .eq('status', 'open')
      .gt('deadline', now.toISOString())
      .lte('deadline', until.toISOString())
      .is('deadline_reminder_sent_at', null)
      .limit(50)

    if (error) {
      console.error('截单提醒查询失败：', error.message)
      return NextResponse.json({ error: `查询失败：${error.message}` }, { status: 500 })
    }

    let sent = 0
    let failed = 0

    type SessionRow = { id: string; host_id: string; title: string; deadline: string }
    for (const raw of (sessions ?? []) as unknown as SessionRow[]) {
      try {
        const minutesLeft = Math.max(
          1,
          Math.round((new Date(raw.deadline).getTime() - now.getTime()) / 60000),
        )
        const result = await sendNotificationToUser(supabase, {
          userId: raw.host_id,
          type: 'order_deadline',
          title: '⏰ 截单提醒',
          body: `「${raw.title}」还有约 ${minutesLeft} 分钟截止，把链接再发一圈、顺便看看大家点了什么吧`,
          url: `/orders/${raw.id}`,
        })

        if (result.notificationId) {
          // 置位防重复标记；即使部分推送失败也算已提醒，避免刷屏重试
          await supabase
            .from('order_sessions')
            .update({ deadline_reminder_sent_at: now.toISOString() })
            .eq('id', raw.id)
          sent += 1
        } else {
          failed += 1
        }
      } catch (err) {
        console.error(`截单提醒发送失败（会话 ${raw.id}）：`, err)
        failed += 1
      }
    }

    return NextResponse.json({ ok: true, checked: sessions?.length ?? 0, sent, failed })
  } catch (err) {
    console.error('截单提醒任务异常：', err)
    return NextResponse.json({ error: `系统异常：${(err as Error).message}` }, { status: 500 })
  }
}
