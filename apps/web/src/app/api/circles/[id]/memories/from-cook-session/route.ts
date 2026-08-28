import { NextResponse } from 'next/server'
import { safeParseCircleMealCookSession } from '@kaifan/shared'
import { requireCircleAccess } from '@/lib/circle-access'
import { createCircleMealFromCookSession } from '@/lib/circle-meals'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const accessResult = await requireCircleAccess(request, id)
  if (!accessResult.ok) return NextResponse.json({ error: accessResult.error }, { status: accessResult.status })

  const parsed = safeParseCircleMealCookSession(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: '分享内容不完整或格式不正确', issues: parsed.error.issues }, { status: 400 })
  }

  try {
    const detail = await createCircleMealFromCookSession(accessResult.access, parsed.data)
    return NextResponse.json({ ok: true, ...detail })
  } catch (err) {
    console.error('从做饭记录分享异常：', err)
    return NextResponse.json({ error: (err as Error).message }, { status: 400 })
  }
}
