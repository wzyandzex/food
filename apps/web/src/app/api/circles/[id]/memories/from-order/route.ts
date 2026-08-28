import { NextResponse } from 'next/server'
import { requireCircleAccess } from '@/lib/circle-access'
import { createCircleMealFromOrder } from '@/lib/circle-meals'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const accessResult = await requireCircleAccess(request, id)
  if (!accessResult.ok) return NextResponse.json({ error: accessResult.error }, { status: accessResult.status })

  const body = (await request.json().catch(() => null)) as {
    sourceOrderSessionId?: unknown
    title?: unknown
    mealDate?: unknown
    mealType?: unknown
    attendeeIds?: unknown
    sharedNote?: unknown
    rating?: unknown
    publish?: unknown
  } | null

  if (typeof body?.sourceOrderSessionId !== 'string') {
    return NextResponse.json({ error: '缺少来源点单' }, { status: 400 })
  }

  try {
    const detail = await createCircleMealFromOrder(accessResult.access, {
      sourceOrderSessionId: body.sourceOrderSessionId,
      title: typeof body.title === 'string' ? body.title : undefined,
      mealDate: typeof body.mealDate === 'string' ? body.mealDate : undefined,
      mealType: ['breakfast', 'lunch', 'dinner', 'supper'].includes(String(body.mealType))
        ? (body.mealType as 'breakfast' | 'lunch' | 'dinner' | 'supper')
        : undefined,
      attendeeIds: Array.isArray(body.attendeeIds)
        ? body.attendeeIds.filter((value): value is string => typeof value === 'string')
        : undefined,
      sharedNote: typeof body.sharedNote === 'string' ? body.sharedNote : null,
      rating: typeof body.rating === 'number' ? body.rating : null,
      publish: body.publish === true,
    })
    return NextResponse.json({ ok: true, ...detail })
  } catch (err) {
    console.error('从点单收档异常：', err)
    return NextResponse.json({ error: (err as Error).message }, { status: 400 })
  }
}
