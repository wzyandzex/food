import { NextResponse } from 'next/server'
import { createServerClient, getAuthUserId } from '@/lib/supabase'

/** 上传菜品成品照片：存到 Supabase Storage 'food-photos' bucket，返回公开 URL。
 *  需已登录（Authorization Bearer），防止匿名滥用存储。 */
export async function POST(request: Request) {
  const userId = await getAuthUserId(request)
  if (!userId) {
    return NextResponse.json({ error: '请先登录后再上传图片' }, { status: 401 })
  }

  const formData = await request.formData()
  const file = formData.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: '请上传图片文件' }, { status: 400 })
  }

  // 基础类型与大小校验（客户端已压到 200KB 左右，服务端设 5MB 上限兜底）
  if (!file.type.startsWith('image/')) {
    return NextResponse.json({ error: '只支持图片文件' }, { status: 400 })
  }
  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: '图片不能超过 5MB' }, { status: 400 })
  }

  try {
    const supabase = createServerClient()
    const ext = file.name.split('.').pop() || 'jpg'
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
    const path = `dishes/${fileName}`

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const { error: uploadError } = await supabase.storage
      .from('food-photos')
      .upload(path, buffer, {
        contentType: file.type,
        upsert: false,
      })

    if (uploadError) {
      // 若 bucket 尚未建立，返回说明
      return NextResponse.json(
        { error: `图片存储失败：${uploadError.message}（请确认 Supabase Storage 中已创建 food-photos 公开 bucket）` },
        { status: 500 },
      )
    }

    const { data: urlData } = supabase.storage.from('food-photos').getPublicUrl(path)
    return NextResponse.json({ url: urlData.publicUrl })
  } catch (err) {
    return NextResponse.json({ error: `上传异常：${(err as Error).message}` }, { status: 500 })
  }
}
