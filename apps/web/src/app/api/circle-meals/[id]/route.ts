import { NextResponse } from 'next/server'
import { requireCircleMealAccess } from '@/lib/circle-access'
import { getCircleMeal, changeCircleMealStatus } from '@/lib/circle-meals'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: memoryId } = await params
  const accessResult = await requireCircleMealAccess(request, memoryId)
  if (!accessResult.ok) return NextResponse.json({ error: accessResult.error }, { status: accessResult.status })

  try {
    const detail = await getCircleMeal(accessResult.access, memoryId)
    if (!detail) return NextResponse.json({ error: '餐桌档案不存在或无权查看' }, { status: 404 })
    return NextResponse.json({ ok: true, ...detail })
  } catch (err) {
    console.error('餐桌档案详情查询异常：', err)
    return NextResponse.json({ error: `加载餐桌档案失败：${(err as Error).message}` }, { status: 500 })
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: memoryId } = await params
  const accessResult = await requireCircleMealAccess(request, memoryId)
  if (!accessResult.ok) return NextResponse.json({ error: accessResult.error }, { status: accessResult.status })

  const body = (await request.json().catch(() => null)) as { status?: unknown } | null
  if (body?.status !== 'published' && body?.status !== 'withdrawn') {
    return NextResponse.json({ error: '档案状态不合法' }, { status: 400 })
  }

  try {
    const detail = await changeCircleMealStatus(accessResult.access, memoryId, body.status)
    if (!detail) return NextResponse.json({ error: '餐桌档案不存在' }, { status: 404 })
    return NextResponse.json({ ok: true, ...detail })
  } catch (err) {
    console.error('餐桌档案状态更新异常：', err)
    return NextResponse.json({ error: (err as Error).message }, { status: 400 })
  }
}
