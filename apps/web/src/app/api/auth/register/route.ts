import { NextResponse } from 'next/server'

import { createServerClient } from '@/lib/supabase'

/** 注册：验证邀请码 → 创建 auth 用户（邮箱确认跳过）→ 建 profile → 扣减邀请码 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    email?: unknown
    password?: unknown
    nickname?: unknown
    inviteCode?: unknown
  } | null

  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
  const password = typeof body?.password === 'string' ? body.password : ''
  const nickname = typeof body?.nickname === 'string' ? body.nickname.trim() : ''
  const inviteCode = typeof body?.inviteCode === 'string' ? body.inviteCode.trim() : ''

  if (!email || !password) {
    return NextResponse.json({ error: '邮箱和密码不能为空' }, { status: 400 })
  }
  if (password.length < 6) {
    return NextResponse.json({ error: '密码至少 6 位' }, { status: 400 })
  }
  if (!inviteCode) {
    return NextResponse.json({ error: '邀请码不能为空' }, { status: 400 })
  }

  const supabase = createServerClient()

  // 1. 校验邀请码（可用且未超用量）
  const { data: invite, error: inviteError } = await supabase
    .from('invite_codes')
    .select('code, max_uses, used_count, revoked')
    .eq('code', inviteCode)
    .single()

  if (inviteError || !invite) {
    return NextResponse.json({ error: '邀请码无效' }, { status: 400 })
  }
  if (invite.revoked) {
    return NextResponse.json({ error: '邀请码已被吊销' }, { status: 400 })
  }
  if (invite.used_count >= invite.max_uses) {
    return NextResponse.json({ error: '邀请码已达使用上限' }, { status: 400 })
  }

  // 2. 创建 auth 用户（email_confirm 跳过邮件验证：亲友圈 + 邀请码即准入）
  const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (authError) {
    const message =
      authError.message.includes('already registered') || authError.message.includes('already been registered')
        ? '该邮箱已注册，请直接登录'
        : `注册失败：${authError.message}`
    return NextResponse.json({ error: message }, { status: 400 })
  }

  // 3. 建 profile + 扣减邀请码用量（事务性不强，M1 亲友圈可接受）
  const { error: profileError } = await supabase.from('profiles').insert({
    id: authUser.user.id,
    nickname: nickname || '美食家',
    invite_code_used: inviteCode,
  })

  if (profileError) {
    // 回滚 auth 用户，避免孤儿
    await supabase.auth.admin.deleteUser(authUser.user.id)
    return NextResponse.json({ error: `创建档案失败：${profileError.message}` }, { status: 500 })
  }

  const { error: consumeError } = await supabase
    .from('invite_codes')
    .update({ used_count: invite.used_count + 1 })
    .eq('code', inviteCode)

  if (consumeError) {
    console.error('邀请码用量扣减失败', consumeError.message)
  }

  return NextResponse.json({ ok: true })
}