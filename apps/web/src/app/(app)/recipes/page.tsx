import Link from 'next/link'

import { SAMPLE_RECIPES } from '@kaifan/shared'

import { IconPlus, IconSearch } from '@/components/icons'
import { PageHeader } from '@/components/ui'
import { createServerClient, isSupabaseConfigured } from '@/lib/supabase'

interface RecipeCard {
  id: string
  title: string
  difficulty: number
  minutes: number
  tags: string[]
}

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
    console.error('菜谱列表查询失败：', error.message)
    return []
  }

  return (data as RecipeCard[]).map((row) => ({
    id: row.id,
    title: row.title,
    difficulty: row.difficulty,
    minutes: row.minutes,
    tags: row.tags ?? [],
  }))
}

export default async function RecipesPage() {
  const recipes = await fetchRecipes()

  return (
    <div className="screen">
      <PageHeader
        title="菜谱"
        subtitle={`共 ${recipes.length} 道拿手菜`}
        action={
          <Link
            href="/recipes/new"
            className="flex items-center gap-1 rounded-full bg-tint px-3 py-1.5 text-[13px] font-semibold text-white transition active:opacity-70"
          >
            <IconPlus className="size-4" />
            <span>自建</span>
          </Link>
        }
      />

      {/* 搜索栏（进入语音 / 关键字搜） */}
      <div className="mb-4">
        <Link
          href="/voice"
          className="flex items-center gap-2.5 rounded-xl bg-surface px-4 py-3 text-[14px] text-ink-3 transition active:bg-fill"
        >
          <IconSearch className="size-4 text-ink-3" />
          <span>搜索菜谱、食材或按住说一句…</span>
        </Link>
      </div>

      {/* 菜谱分组列表 */}
      {recipes.length === 0 ? (
        <div className="card px-6 py-12 text-center space-y-3">
          <p className="text-[15px] font-semibold text-ink">还没有菜谱</p>
          <p className="text-[13px] text-ink-3 leading-5">添加你的专属拿手菜，后续做饭、排餐、点单都能直接调用</p>
          <Link
            href="/recipes/new"
            className="inline-flex items-center gap-1 rounded-xl bg-tint px-4 py-2 text-[13px] font-semibold text-white active:opacity-70"
          >
            <IconPlus className="size-4" />
            <span>自建第一道菜</span>
          </Link>
        </div>
      ) : (
        <div className="list-group">
          {recipes.map((recipe, index) => {
            const isLast = index === recipes.length - 1
            return (
              <Link
                key={recipe.id}
                href={`/recipes/${encodeURIComponent(recipe.id)}`}
                className={`flex items-center gap-3.5 px-4 py-3.5 transition-colors active:bg-fill ${
                  isLast ? '' : 'border-b border-line'
                }`}
              >
                <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-tint-soft text-[17px] font-bold text-tint-deep">
                  {recipe.title.slice(0, 1)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-[15px] font-semibold text-ink">{recipe.title}</p>
                    <span className="shrink-0 text-[12px] text-ink-3">
                      {'★'.repeat(recipe.difficulty)}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-[12px] text-ink-3">
                    ⏱ {recipe.minutes} 分钟
                    {recipe.tags.length > 0 && ` · ${recipe.tags.join(' / ')}`}
                  </p>
                </div>
                <span className="shrink-0 text-[17px] text-ink-3/60">›</span>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
