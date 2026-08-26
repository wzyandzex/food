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

/** 安全解析数据库中存储的 items jsonb 数组为强类型的 ShoppingListItem[] */
function parseDbItems(raw: unknown): ShoppingListItem[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
    .map((item) => ({
      id: typeof item.id === 'string' && item.id.trim() ? item.id.trim() : randomUUID(),
      name: typeof item.name === 'string' ? item.name.trim() : '',
      qty: typeof item.qty === 'number' && !Number.isNaN(item.qty) && item.qty > 0 ? item.qty : null,
      unit: typeof item.unit === 'string' ? item.unit.trim() : '',
      checked: Boolean(item.checked),
      sourceRecipeTitle: typeof item.sourceRecipeTitle === 'string' ? item.sourceRecipeTitle.trim() : undefined,
    }))
    .filter((item) => item.name.length > 0)
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
      console.error('获取购物清单失败：', error.message)
      return NextResponse.json({ error: `获取购物清单失败：${error.message}` }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json({ list: null, items: [] })
    }

    const items = parseDbItems(data.items)

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
      id: typeof item.id === 'string' && item.id.trim() ? item.id.trim() : randomUUID(),
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
      // 智能合并同名食材（同名且同单位则合并累加；保留已有已备齐状态，避免打乱备料计划）
      const existingItems = parseDbItems(currentList.items)
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
          // 保留已有的已备齐状态：若之前已买齐，新加进来不强制重置为未买
          if (!exist.checked && item.checked) {
            exist.checked = true
          }
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

    // 新建清单或直接 replace
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
