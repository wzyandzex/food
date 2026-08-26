import { NextResponse } from 'next/server'
import { randomBytes } from 'node:crypto'
import { createServerClient, getAuthUserId } from '@/lib/supabase'

/** 生成圈内邀请链接：owner 专用；撤销旧邀请后发新 token（7 天有效） */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getAuthUserId(request)
  if (!userId) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 })
  }

  const { id } = await params

  try {
    const supabase = createServerClient()

    // owner 校验
    const { data: membership, error: membershipError } = await supabase
      .from('circle_members')
      .select('role')
      .eq('circle_id', id)
      .eq('user_id', userId)
      .maybeSingle()

    if (membershipError) throw new Error(membershipError.message)
    if (!membership || membership.role !== 'owner') {
      return NextResponse.json({ error: '只有群主才能生成邀请链接' }, { status: 403 })
    }

    // 撤销旧邀请（保持一个圈只有一个活跃链接，方便管理）
    const { error: revokeError } = await supabase
      .from('circle_invites')
      .update({ revoked: true })
      .eq('circle_id', id)
      .eq('revoked', false)

    if (revokeError) throw new Error(revokeError.message)

    const token = randomBytes(16).toString('hex')
    const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString()

    const { error: insertError } = await supabase.from('circle_invites').insert({
      token,
      circle_id: id,
      created_by: userId,
      expires_at: expiresAt,
    })

    if (insertError) throw new Error(insertError.message)

    return NextResponse.json({ ok: true, token, path: `/join/${token}`, expiresAt })
  } catch (err) {
    console.error('生成邀请链接异常：', err)
    return NextResponse.json({ error: `系统异常：${(err as Error).message}` }, { status: 500 })
  }
}
