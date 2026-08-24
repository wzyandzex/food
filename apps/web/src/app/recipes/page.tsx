import Link from 'next/link'

import { SAMPLE_RECIPES } from '@kaifan/shared'

import { createServerClient } from '@/lib/supabase'

interface RecipeRow {
  id: string
  title: string
  difficulty: number
  minutes: number
  tags: string[]
  steps: unknown
  ingredients: unknown
}

interface RecipeCard {
  id: string
  title: string
  difficulty: number
  minutes: number
  tags: string[]
}

async function fetchRecipes(): Promise<RecipeCard[]> {
  try {
    const supabase = createServerClient()
    const { data, error } = await supabase
      .from('recipes')
      .select('id, title, difficulty, minutes, tags, steps, ingredients')
      .eq('status', 'published')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })

    if (error) throw error

    return (data as RecipeRow[]).map((row) => ({
      id: row.id,
      title: row.title,
      difficulty: row.difficulty,
      minutes: row.minutes,
      tags: row.tags,
    }))
  } catch {
    // 未配置 Supabase 时降级到样例数据，保证页面可预览
    return SAMPLE_RECIPES.map((recipe) => ({
      id: recipe.title,
      title: recipe.title,
      difficulty: recipe.difficulty,
      minutes: recipe.minutes,
      tags: recipe.tags,
    }))
  }
}

export default async function RecipesPage() {
  const recipes = await fetchRecipes()

  return (
    <main className="mx-auto min-h-dvh w-full max-w-md px-5 pt-12 pb-10">
      <header className="mb-6">
        <Link href="/" className="mb-2 inline-block text-sm text-ink/50">
          ← 返回首页
        </Link>
        <h1 className="text-xl font-bold">菜谱市场</h1>
        <p className="text-sm text-ink/60">搜索、收藏与自建菜谱</p>
      </header>

      <section className="space-y-3">
        {recipes.map((recipe) => (
          <Link
            key={recipe.id}
            href={`/recipes/${encodeURIComponent(recipe.id)}`}
            className="block rounded-2xl bg-white p-5 shadow-sm active:scale-[0.99]"
          >
            <div className="mb-1 flex items-center justify-between">
              <h2 className="font-semibold">{recipe.title}</h2>
              <span className="text-xs text-ink/40">
                {'⭐'.repeat(recipe.difficulty)}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm text-ink/55">
              <span>⏱ {recipe.minutes} 分钟</span>
              {recipe.tags.length > 0 && (
                <span className="truncate">
                  {' · '}
                  {recipe.tags.slice(0, 3).join(' / ')}
                </span>
              )}
            </div>
          </Link>
        ))}
        {recipes.length === 0 && (
          <p className="rounded-2xl bg-white p-6 text-center text-sm text-ink/50">
            暂无菜谱，去管理端导入吧
          </p>
        )}
      </section>
    </main>
  )
}