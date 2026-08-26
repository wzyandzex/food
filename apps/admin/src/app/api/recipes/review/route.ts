import { NextResponse } from 'next/server'

import { getAdminClient } from '@/lib/supabase'

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
 *  - action='publish' → status 置为 'published'
 *  - action='reject'  → 级联删除 recipe 记录（recipe_ingredients 级联删） */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    recipeId?: unknown
    action?: unknown
  } | null

  const recipeId = typeof body?.recipeId === 'string' ? body.recipeId.trim() : ''
  const action = typeof body?.action === 'string' ? body.action.trim() : ''

  if (!recipeId) {
    return NextResponse.json({ error: '缺少 recipeId' }, { status: 400 })
  }
  if (action !== 'publish' && action !== 'reject') {
    return NextResponse.json({ error: 'action 必须为 publish 或 reject' }, { status: 400 })
  }

  const supabase = getAdminClient()

  if (action === 'publish') {
    const { error } = await supabase
      .from('recipes')
      .update({ status: 'published', updated_at: new Date().toISOString() })
      .eq('id', recipeId)
      .eq('status', 'pending')

    if (error) {
      return NextResponse.json({ error: `发布失败：${error.message}` }, { status: 500 })
    }
    return NextResponse.json({ ok: true, message: '已发布并上架菜谱市场' })
  }

  // action === 'reject'：彻底清除暂存记录
  const { error } = await supabase.from('recipes').delete().eq('id', recipeId).eq('status', 'pending')
  if (error) {
    return NextResponse.json({ error: `驳回清理失败：${error.message}` }, { status: 500 })
  }
  return NextResponse.json({ ok: true, message: '已驳回并清理暂存数据' })
}
