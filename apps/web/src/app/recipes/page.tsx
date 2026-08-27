import Link from 'next/link'

import { SAMPLE_RECIPES } from '@kaifan/shared'

import { createServerClient, isSupabaseConfigured } from '@/lib/supabase'

interface RecipeRow {
  id: string
  title: string
  difficulty: number
  minutes: number
  tags: string[]
}

interface RecipeCard {
  id: string
  title: string
  difficulty: number
  minutes: number
  tags: string[]
}

/** 样例数据降级：仅在服务端数据源「未配置」时使用，保证本地可预览 */
function sampleCards(): RecipeCard[] {
  return SAMPLE_RECIPES.map((recipe) => ({
    id: recipe.title,
    title: recipe.title,
    difficulty: recipe.difficulty,
    minutes: recipe.minutes,
    tags: recipe.tags,
  }))
}

async function fetchRecipes(): Promise<RecipeCard[]> {
  if (!isSupabaseConfigured()) return sampleCards()

  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('recipes')
    .select('id, title, difficulty, minutes, tags')
    .eq('status', 'published')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (error) {
    // 查询失败是异常而非「没有数据」：记日志并返回空列表，让页面呈现真实状态
    console.error('菜谱市场列表查询失败：', error.message)
    return []
  }

  return (data as RecipeRow[]).map((row) => ({
    id: row.id,
    title: row.title,
    difficulty: row.difficulty,
    minutes: row.minutes,
    tags: row.tags,
  }))
}

export default async function RecipesPage() {
  const recipes = await fetchRecipes()

  return (
    <main className="mx-auto min-h-dvh w-full max-w-md px-5 pt-12 pb-10">
      <header className="mb-6 flex items-start justify-between gap-3">
        <div>
          <Link href="/" className="mb-2 inline-block text-sm text-ink/50">
            ← 返回首页
          </Link>
          <h1 className="text-xl font-bold">菜谱市场</h1>
          <p className="text-sm text-ink/60">搜索、自建与改编菜谱</p>
        </div>
        <Link
          href="/recipes/new"
          className="mt-6 rounded-xl bg-brand px-3.5 py-2 text-xs font-semibold text-white shadow-sm active:scale-95 shrink-0"
        >
          + 自建菜谱
        </Link>
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
