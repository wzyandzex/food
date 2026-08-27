import { NextResponse } from 'next/server'
import { isValidRecipeTransition } from '@kaifan/shared'
import { getAdminClient } from '@/lib/supabase'
import { logAdminAction } from '@/lib/audit-logger'

interface PendingRecipeItem {
  id: string
  title: string
  source_type: string
  difficulty: number
  minutes: number
  tags: string[]
  created_at: string
}

/** 待确认队列查询：拉取 status='pending' 且未删除的菜谱列表（PRD §4.2 两段式第二段） */
export async function GET() {
  const supabase = getAdminClient()
  const { data, error } = await supabase
    .from('recipes')
    .select('id, title, source_type, difficulty, minutes, tags, created_at')
    .eq('status', 'pending')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) {
    console.error('获取待确认列表失败：', error.message)
    return NextResponse.json({ error: '获取待确认列表失败' }, { status: 500 })
  }

  return NextResponse.json({ items: (data as PendingRecipeItem[]) ?? [] })
}

/** 审核动作：对指定待确认菜谱进行「发布」或「驳回」
 *  - action='publish' → status 校验合法迁移置为 'published'
 *  - action='reject'  → 软删除并更新为 'rejected' 状态，记录操作审计（DATA_MODEL.md §2.1 & SECURITY_AUDIT.md §4） */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    recipeId?: unknown
    action?: unknown
    reason?: unknown
  } | null

  const recipeId = typeof body?.recipeId === 'string' ? body.recipeId.trim() : ''
  const action = typeof body?.action === 'string' ? body.action.trim() : ''
  const reason = typeof body?.reason === 'string' ? body.reason.trim() : undefined

  if (!recipeId) {
    return NextResponse.json({ error: '缺少 recipeId' }, { status: 400 })
  }
  if (action !== 'publish' && action !== 'reject') {
    return NextResponse.json({ error: 'action 必须为 publish 或 reject' }, { status: 400 })
  }

  const supabase = getAdminClient()

  // 1. 检查当前菜谱状态与迁移合法性
  const { data: recipe, error: fetchError } = await supabase
    .from('recipes')
    .select('id, title, status')
    .eq('id', recipeId)
    .single()

  if (fetchError || !recipe) {
    return NextResponse.json({ error: '菜谱不存在或已处理' }, { status: 404 })
  }

  const targetStatus = action === 'publish' ? 'published' : 'rejected'
  if (!isValidRecipeTransition(recipe.status, targetStatus) && recipe.status !== 'pending') {
    return NextResponse.json(
      { error: `非法状态流转：无法从 ${recipe.status} 流转至 ${targetStatus}` },
      { status: 400 },
    )
  }

  if (action === 'publish') {
    const { error } = await supabase
      .from('recipes')
      .update({ status: 'published', updated_at: new Date().toISOString() })
      .eq('id', recipeId)

    if (error) {
      return NextResponse.json({ error: `发布失败：${error.message}` }, { status: 500 })
    }

    await logAdminAction({
      action: 'recipe.publish',
      resourceType: 'recipe',
      resourceId: recipeId,
      metadata: { title: recipe.title, previousStatus: recipe.status },
    })

    return NextResponse.json({ ok: true, message: '已发布并上架菜谱市场' })
  }

  // action === 'reject'：执行软删除与状态更新，完整保留操作审计轨迹
  const { error } = await supabase
    .from('recipes')
    .update({
      status: 'rejected',
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', recipeId)
    .eq('status', 'pending')

  if (error) {
    return NextResponse.json({ error: `驳回操作失败：${error.message}` }, { status: 500 })
  }

  await logAdminAction({
    action: 'recipe.reject',
    resourceType: 'recipe',
    resourceId: recipeId,
    metadata: { title: recipe.title, reason },
  })

  return NextResponse.json({ ok: true, message: '已驳回并归档暂存数据' })
}
