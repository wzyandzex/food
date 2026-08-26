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

/** 样例搜索：仅在服务端数据源未配置时使用 */
function searchSamples(query: string): RecipeRow[] {
  return SAMPLE_RECIPES.filter((recipe) =>
    recipe.title.toLowerCase().includes(query.toLowerCase()),
  ).map((recipe) => ({
    id: recipe.title,
    title: recipe.title,
    difficulty: recipe.difficulty,
    minutes: recipe.minutes,
    tags: recipe.tags,
  }))
}

/** 菜谱搜索：标题模糊匹配（ILIKE）+ 标签匹配；无数据库时降级到样例 */
export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get('q')?.trim()
  if (!query) {
    return NextResponse.json({ recipes: [] })
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ recipes: searchSamples(query) })
  }

  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('recipes')
    .select('id, title, difficulty, minutes, tags')
    .eq('status', 'published')
    .is('deleted_at', null)
    .ilike('title', `%${query}%`)
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) {
    console.error('菜谱搜索查询失败：', error.message)
    return NextResponse.json({ recipes: [] })
  }

  return NextResponse.json({ recipes: data as RecipeRow[] })
}