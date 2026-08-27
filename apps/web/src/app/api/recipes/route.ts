import { NextResponse } from 'next/server'
import { safeParseRecipe, formatRecipeIssues } from '@kaifan/shared'
import { createServerClient, getAuthUserId } from '@/lib/supabase'
import { saveUserRecipe } from '@/lib/user-recipe-writer'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** 用户端创建自建/改编菜谱（PRD §4.2 自建与 fork 改编） */
export async function POST(request: Request) {
  const userId = await getAuthUserId(request)
  if (!userId) {
    return NextResponse.json({ error: '请先登录后再创建或改编菜谱' }, { status: 401 })
  }

  const body = (await request.json().catch(() => null)) as {
    recipe?: unknown
    derivedFrom?: unknown
  } | null

  if (!body?.recipe) {
    return NextResponse.json({ error: '缺少菜谱数据' }, { status: 400 })
  }

  const parsed = safeParseRecipe(body.recipe)
  if (!parsed.success) {
    return NextResponse.json(
      { error: `菜谱校验失败：${formatRecipeIssues(parsed.error).join('；')}` },
      { status: 422 },
    )
  }

  // 校验 derivedFrom（若有）
  let derivedFrom: string | null = null
  if (typeof body.derivedFrom === 'string' && body.derivedFrom.trim()) {
    const rawId = body.derivedFrom.trim()
    if (!UUID_RE.test(rawId)) {
      return NextResponse.json({ error: '被改编菜谱标识不合法' }, { status: 400 })
    }
    const supabase = createServerClient()
    const { data: parent } = await supabase
      .from('recipes')
      .select('id')
      .eq('id', rawId)
      .is('deleted_at', null)
      .maybeSingle()

    if (!parent) {
      return NextResponse.json({ error: '原菜谱不存在或已被删除' }, { status: 404 })
    }
    derivedFrom = rawId
  }

  try {
    const result = await saveUserRecipe({
      recipe: parsed.data,
      userId,
      derivedFrom,
    })

    if (!result.ok || !result.recipeId) {
      return NextResponse.json({ error: result.message }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      recipeId: result.recipeId,
      message: result.message,
    })
  } catch (err) {
    console.error('自建/改编菜谱异常：', err)
    return NextResponse.json({ error: `系统异常：${(err as Error).message}` }, { status: 500 })
  }
}
