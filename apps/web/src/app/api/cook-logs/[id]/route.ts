import { NextResponse } from 'next/server'
import { createServerClient, getAuthUserId } from '@/lib/supabase'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getAuthUserId(request)
  if (!userId) return NextResponse.json({ error: '请先登录' }, { status: 401 })

  const { id } = await params
  try {
    const supabase = createServerClient()
    const { data, error } = await supabase
      .from('cook_sessions')
      .select('id, date, meal_type, rating, cook_dishes(id, snapshot_title, snapshot_cover, photos, adjust_note)')
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle()

    if (error) throw new Error(error.message)
    if (!data) return NextResponse.json({ error: '做饭记录不存在或无权查看' }, { status: 404 })
    return NextResponse.json({ ok: true, log: data })
  } catch (err) {
    console.error('做饭记录详情查询异常：', err)
    return NextResponse.json({ error: '做饭记录加载失败' }, { status: 500 })
  }
}
