import { NextResponse } from 'next/server'
import { createServerClient, getAuthUserId } from '@/lib/supabase'

interface ShoppingItem {
  name: string
  qty?: number
  unit?: string
}

/** 把缺失食材清单一键写入购物清单（shopping_lists，PRD §4.4）。
 *  需登录；每次写入新建一份清单，items 形如 [{name, qty, unit, checked}]。 */
export async function POST(request: Request) {
  const userId = await getAuthUserId(request)
  if (!userId) {
    return NextResponse.json({ error: '请先登录后再使用购物清单' }, { status: 401 })
  }

  const body = (await request.json().catch(() => null)) as { items?: ShoppingItem[] } | null
  if (!Array.isArray(body?.items) || body.items.length === 0) {
    return NextResponse.json({ error: '清单为空，先勾掉「家里已有」的食材吧' }, { status: 400 })
  }

  // 只保留有名字的条目，数量与单位可选
  const items = body.items
    .filter((item) => typeof item?.name === 'string' && item.name.trim())
    .map((item) => ({
      name: item.name.trim(),
      qty: typeof item.qty === 'number' && item.qty > 0 ? item.qty : null,
      unit: typeof item.unit === 'string' ? item.unit : '',
      checked: false,
    }))

  if (items.length === 0) {
    return NextResponse.json({ error: '清单内容不合法' }, { status: 400 })
  }

  try {
    const supabase = createServerClient()
    const { data, error } = await supabase
      .from('shopping_lists')
      .insert({ owner_id: userId, items })
      .select('id')
      .single()

    if (error || !data) {
      return NextResponse.json({ error: `购物清单保存失败：${error?.message}` }, { status: 500 })
    }

    return NextResponse.json({ ok: true, listId: data.id as string, count: items.length })
  } catch (err) {
    console.error('购物清单写入异常：', err)
    return NextResponse.json({ error: `系统异常：${(err as Error).message}` }, { status: 500 })
  }
}
