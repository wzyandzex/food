import { NextResponse } from 'next/server'
import { createServerClient, getAuthUserId } from '@/lib/supabase'

/** 非成员退圈；owner 提示须解散 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getAuthUserId(request)
  if (!userId) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 })
  }

  const { id } = await params

  try {
    const supabase = createServerClient()

    const { data: membership, error: membershipError } = await supabase
      .from('circle_members')
      .select('role')
      .eq('circle_id', id)
      .eq('user_id', userId)
      .maybeSingle()

    if (membershipError) throw new Error(membershipError.message)
    if (!membership) {
      return NextResponse.json({ error: '你还不是这个圈的成员' }, { status: 404 })
    }
    if (membership.role === 'owner') {
      return NextResponse.json({ error: '群主不能退出圈子，只能解散圈子' }, { status: 400 })
    }

    const { error } = await supabase
      .from('circle_members')
      .delete()
      .eq('circle_id', id)
      .eq('user_id', userId)

    if (error) throw new Error(error.message)

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('退圈异常：', err)
    return NextResponse.json({ error: `系统异常：${(err as Error).message}` }, { status: 500 })
  }
}
