import { NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import type { ShoppingListItem } from '@kaifan/shared'
import { createServerClient, getAuthUserId } from '@/lib/supabase'

interface RawIncomingItem {
  id?: string
  name: string
  qty?: number | null
  unit?: string | null
  checked?: boolean
  sourceRecipeTitle?: string
}

/** 获取用户的当前/最新活跃购物清单 */
export async function GET(request: Request) {
  const userId = await getAuthUserId(request)
  if (!userId) {
    return NextResponse.json({ error: '请先登录后再查看购物清单' }, { status: 401 })
  }

  try {
    const supabase = createServerClient()
    const { data, error } = await supabase
      .from('shopping_lists')
      .select('id, owner_id, source_order_session_id, items, created_at, updated_at')
      .eq('owner_id', userId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      return NextResponse.json({ error: `获取购物清单失败：${error.message}` }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json({ list: null, items: [] })
    }

    // 格式化补全 id
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawItems = (data.items as any[]) || []
    const items: ShoppingListItem[] = rawItems.map((item) => ({
      id: item.id || randomUUID(),
      name: item.name || '',
      qty: typeof item.qty === 'number' ? item.qty : null,
      unit: typeof item.unit === 'string' ? item.unit : '',
      checked: Boolean(item.checked),
      sourceRecipeTitle: item.sourceRecipeTitle || undefined,
    }))

    return NextResponse.json({
      list: {
        id: data.id,
        ownerId: data.owner_id,
        sourceOrderSessionId: data.source_order_session_id,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      },
      items,
    })
  } catch (err) {
    console.error('获取购物清单异常：', err)
    return NextResponse.json({ error: `系统异常：${(err as Error).message}` }, { status: 500 })
  }
}

/** 追加/合并食材到当前活跃清单（若不存在则自动新建） */
export async function POST(request: Request) {
  const userId = await getAuthUserId(request)
  if (!userId) {
    return NextResponse.json({ error: '请先登录后再使用购物清单' }, { status: 401 })
  }

  const body = (await request.json().catch(() => null)) as {
    items?: RawIncomingItem[]
    sourceOrderSessionId?: string
    mode?: 'append' | 'replace'
  } | null

  if (!Array.isArray(body?.items) || body.items.length === 0) {
    return NextResponse.json({ error: '食材清单为空' }, { status: 400 })
  }

  const newItems: ShoppingListItem[] = body.items
    .filter((item) => typeof item?.name === 'string' && item.name.trim())
    .map((item) => ({
      id: item.id || randomUUID(),
      name: item.name.trim(),
      qty: typeof item.qty === 'number' && item.qty > 0 ? item.qty : null,
      unit: typeof item.unit === 'string' ? item.unit.trim() : '',
      checked: Boolean(item.checked),
      sourceRecipeTitle: item.sourceRecipeTitle?.trim() || undefined,
    }))

  if (newItems.length === 0) {
    return NextResponse.json({ error: '清单内容不合法' }, { status: 400 })
  }

  try {
    const supabase = createServerClient()
    // 查现有最新清单
    const { data: currentList } = await supabase
      .from('shopping_lists')
      .select('id, items')
      .eq('owner_id', userId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (currentList && body?.mode !== 'replace') {
      // 智能合并同名食材
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const existingItems: ShoppingListItem[] = (currentList.items as any[]) || []
      const mergedMap = new Map<string, ShoppingListItem>()

      for (const item of existingItems) {
        mergedMap.set(`${item.name}__${item.unit || ''}`, { ...item })
      }

      for (const item of newItems) {
        const key = `${item.name}__${item.unit || ''}`
        const exist = mergedMap.get(key)
        if (exist) {
          if (typeof exist.qty === 'number' && typeof item.qty === 'number') {
            exist.qty += item.qty
          } else if (typeof item.qty === 'number') {
            exist.qty = item.qty
          }
          // 如果新加进来的未买，重置勾选
          if (!item.checked) exist.checked = false
        } else {
          mergedMap.set(key, item)
        }
      }

      const finalItems = Array.from(mergedMap.values())
      const { error: updateError } = await supabase
        .from('shopping_lists')
        .update({
          items: finalItems,
          updated_at: new Date().toISOString(),
        })
        .eq('id', currentList.id)

      if (updateError) {
        return NextResponse.json({ error: `更新购物清单失败：${updateError.message}` }, { status: 500 })
      }

      return NextResponse.json({ ok: true, listId: currentList.id, items: finalItems })
    }

    // 新建清单
    const { data: created, error: insertError } = await supabase
      .from('shopping_lists')
      .insert({
        owner_id: userId,
        source_order_session_id: body?.sourceOrderSessionId || null,
        items: newItems,
      })
      .select('id')
      .single()

    if (insertError || !created) {
      return NextResponse.json({ error: `创建购物清单失败：${insertError?.message}` }, { status: 500 })
    }

    return NextResponse.json({ ok: true, listId: created.id, items: newItems })
  } catch (err) {
    console.error('购物清单操作异常：', err)
    return NextResponse.json({ error: `系统异常：${(err as Error).message}` }, { status: 500 })
  }
}
