import { NextResponse } from 'next/server'
import { safeParseCircleMealContribution } from '@kaifan/shared'
import { requireCircleMealAccess } from '@/lib/circle-access'
import { addContribution, deleteContribution } from '@/lib/circle-meals'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: memoryId } = await params
  const accessResult = await requireCircleMealAccess(request, memoryId)
  if (!accessResult.ok) return NextResponse.json({ error: accessResult.error }, { status: accessResult.status })

  const parsed = safeParseCircleMealContribution(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: '分享内容不完整或格式不正确', issues: parsed.error.issues }, { status: 400 })
  }

  try {
    const contribution = await addContribution(accessResult.access, memoryId, parsed.data)
    return NextResponse.json({ ok: true, contribution })
  } catch (err) {
    console.error('餐桌贡献保存异常：', err)
    return NextResponse.json({ error: (err as Error).message }, { status: 400 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: memoryId } = await params
  const contributionId = new URL(request.url).searchParams.get('contributionId')
  if (!contributionId) return NextResponse.json({ error: '缺少贡献标识' }, { status: 400 })
  const accessResult = await requireCircleMealAccess(request, memoryId)
  if (!accessResult.ok) return NextResponse.json({ error: accessResult.error }, { status: accessResult.status })

  try {
    await deleteContribution(accessResult.access, memoryId, contributionId)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('餐桌贡献撤回异常：', err)
    return NextResponse.json({ error: (err as Error).message }, { status: 400 })
  }
}
