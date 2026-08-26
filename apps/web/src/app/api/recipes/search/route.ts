import { NextResponse } from 'next/server'

import { createServerClient, isSupabaseConfigured } from '@/lib/supabase'
import { SAMPLE_RECIPES } from '@kaifan/shared'

interface RecipeRow {
  id: string
  title: string
  difficulty: number
  minutes: number
  tags: string[]
}

/** 样例数据（仅在服务端数据源未配置时使用）。
 *  注意：样例 id 是菜名而非真实 UUID，调用方不得将其写入库中的 uuid 列。 */
function sampleRecipes(): RecipeRow[] {
  return SAMPLE_RECIPES.map((recipe) => ({
    id: recipe.title,
    title: recipe.title,
    difficulty: recipe.difficulty,
    minutes: recipe.minutes,
    tags: recipe.tags,
  }))
}

function searchSamples(query: string): RecipeRow[] {
  return sampleRecipes().filter((recipe) =>
    recipe.title.toLowerCase().includes(query.toLowerCase()),
  )
}

/** 菜谱搜索：
 * - 带 q：标题模糊匹配（ILIKE）
 * - 不带 q：返回最近发布的菜谱（供发起/参与点单挑选候选）
 * 响应带 source 字段（db / sample / empty），调用方据此区分真实 id 与演示 id */
export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get('q')?.trim()

  if (!isSupabaseConfigured()) {
    const samples = query ? searchSamples(query) : sampleRecipes()
    return NextResponse.json({ recipes: samples, source: 'sample' })
  }

  const supabase = createServerClient()
  let builder = supabase
    .from('recipes')
    .select('id, title, difficulty, minutes, tags')
    .eq('status', 'published')
    .is('deleted_at', null)

  if (query) {
    builder = builder.ilike('title', `%${query}%`)
  }

  const { data, error } = await builder
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) {
    console.error('菜谱搜索查询失败：', error.message)
    return NextResponse.json({ recipes: [], source: 'empty' })
  }

  return NextResponse.json({ recipes: data as RecipeRow[], source: 'db' })
}
