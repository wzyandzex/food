import { NextResponse } from 'next/server'
import type { ShoppingListItem } from '@kaifan/shared'
import { createServerClient, getAuthUserId } from '@/lib/supabase'

/** 更新单份购物清单（切换条目状态、编辑数量或清除已备齐项） */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await getAuthUserId(request)
  if (!userId) {
    return NextResponse.json({ error: '请先登录后再操作购物清单' }, { status: 401 })
  }

  const { id } = await params
  const body = (await request.json().catch(() => null)) as {
    items?: ShoppingListItem[]
  } | null

  if (!Array.isArray(body?.items)) {
    return NextResponse.json({ error: '请提供完整的清单条目数组' }, { status: 400 })
  }

  try {
    const supabase = createServerClient()

    // 确保是该用户拥有的清单
    const { data: listData, error: checkError } = await supabase
      .from('shopping_lists')
      .select('id, owner_id')
      .eq('id', id)
      .eq('owner_id', userId)
      .single()

    if (checkError || !listData) {
      return NextResponse.json({ error: '购物清单不存在或无权修改' }, { status: 404 })
    }

    const { error: updateError } = await supabase
      .from('shopping_lists')
      .update({
        items: body.items,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (updateError) {
      return NextResponse.json({ error: `更新失败：${updateError.message}` }, { status: 500 })
    }

    return NextResponse.json({ ok: true, items: body.items })
  } catch (err) {
    console.error('更新购物清单条目异常：', err)
    return NextResponse.json({ error: `系统异常：${(err as Error).message}` }, { status: 500 })
  }
}

/** 删除指定购物清单 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await getAuthUserId(request)
  if (!userId) {
    return NextResponse.json({ error: '请先登录后再删除购物清单' }, { status: 401 })
  }

  const { id } = await params

  try {
    const supabase = createServerClient()
    const { error } = await supabase
      .from('shopping_lists')
      .delete()
      .eq('id', id)
      .eq('owner_id', userId)

    if (error) {
      return NextResponse.json({ error: `删除失败：${error.message}` }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('删除购物清单异常：', err)
    return NextResponse.json({ error: `系统异常：${(err as Error).message}` }, { status: 500 })
  }
}
