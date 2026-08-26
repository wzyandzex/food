import { NextResponse } from 'next/server'
import { createServerClient, getAuthUserId } from '@/lib/supabase'

const ALLOWED_STATUSES = new Set(['planned', 'cooked', 'skipped'])

/** 更新单格状态（已做 / 跳过 / 恢复计划） */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getAuthUserId(request)
  if (!userId) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 })
  }

  const { id } = await params
  const body = (await request.json().catch(() => null)) as {
    status?: unknown
    note?: unknown
  } | null

  const status = typeof body?.status === 'string' ? body.status : null
  if (!status || !ALLOWED_STATUSES.has(status)) {
    return NextResponse.json({ error: 'status 必须是 planned/cooked/skipped' }, { status: 400 })
  }

  try {
    const supabase = createServerClient()
    const update: Record<string, unknown> = { status }
    if (typeof body?.note === 'string') {
      update.note = body.note.trim() || null
    }

    const { error } = await supabase.from('meal_plan_entries').update(update).eq('id', id).eq('user_id', userId)

    if (error) throw new Error(error.message)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('排餐计划更新异常：', err)
    return NextResponse.json({ error: `系统异常：${(err as Error).message}` }, { status: 500 })
  }
}

/** 删除一格安排 */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getAuthUserId(request)
  if (!userId) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 })
  }

  const { id } = await params

  try {
    const supabase = createServerClient()
    const { error } = await supabase.from('meal_plan_entries').delete().eq('id', id).eq('user_id', userId)

    if (error) throw new Error(error.message)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('排餐计划删除异常：', err)
    return NextResponse.json({ error: `系统异常：${(err as Error).message}` }, { status: 500 })
  }
}
