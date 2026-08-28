import { NextResponse } from 'next/server'
import { safeParseCircleMealMemory } from '@kaifan/shared'
import { requireCircleAccess } from '@/lib/circle-access'
import { createCircleMeal, listCircleMeals } from '@/lib/circle-meals'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const accessResult = await requireCircleAccess(request, id)
  if (!accessResult.ok) return NextResponse.json({ error: accessResult.error }, { status: accessResult.status })

  try {
    const memories = await listCircleMeals(accessResult.access)
    return NextResponse.json({ ok: true, memories })
  } catch (err) {
    console.error('餐桌档案列表查询异常：', err)
    return NextResponse.json({ error: `加载餐桌档案失败：${(err as Error).message}` }, { status: 500 })
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const accessResult = await requireCircleAccess(request, id)
  if (!accessResult.ok) return NextResponse.json({ error: accessResult.error }, { status: accessResult.status })

  const parsed = safeParseCircleMealMemory(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: '餐桌档案内容不完整或格式不正确', issues: parsed.error.issues }, { status: 400 })
  }

  try {
    const memory = await createCircleMeal(accessResult.access, parsed.data)
    return NextResponse.json({ ok: true, memory })
  } catch (err) {
    console.error('餐桌档案创建异常：', err)
    return NextResponse.json({ error: `创建餐桌档案失败：${(err as Error).message}` }, { status: 500 })
  }
}
