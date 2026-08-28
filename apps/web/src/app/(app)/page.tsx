import Link from 'next/link'

import { SAMPLE_RECIPES } from '@kaifan/shared'

import { IconChevronRight, IconFridge } from '@/components/icons'
import { HomeGreeting } from '@/components/home-greeting'
import { RecentCooks } from '@/components/recent-cooks'
import { createServerClient, isSupabaseConfigured } from '@/lib/supabase'

interface RecipeCard {
  id: string
  title: string
  minutes: number
  difficulty: number
  tags: string[]
}

async function fetchTodayRecipes(): Promise<RecipeCard[]> {
  if (!isSupabaseConfigured()) {
    return SAMPLE_RECIPES.map((recipe) => ({
      id: recipe.title,
      title: recipe.title,
      minutes: recipe.minutes,
      difficulty: recipe.difficulty,
      tags: recipe.tags,
    }))
  }

  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('recipes')
    .select('id, title, minutes, difficulty, tags')
    .eq('status', 'published')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(12)

  if (error) {
    console.error('首页推荐菜谱查询失败：', error.message)
    return []
  }
  return (data as RecipeCard[]) ?? []
}

/** 按日期轮换「今日推荐」，同一天内稳定 */
function pickTodayPicks(recipes: RecipeCard[], count = 3): RecipeCard[] {
  if (recipes.length <= count) return recipes
  const dayIndex = Math.floor(Date.now() / 86_400_000)
  const start = dayIndex % recipes.length
  const result: RecipeCard[] = []
  for (let i = 0; i < count; i += 1) {
    const item = recipes[(start + i) % recipes.length]
    if (item) result.push(item)
  }
  return result
}

export default async function HomePage() {
  const recipes = await fetchTodayRecipes()
  const picks = pickTodayPicks(recipes)

  return (
    <div className="pb-2">
      <HomeGreeting />

      {/* 主角：今天吃什么 */}
      <section className="px-4">
        <p className="px-1 text-[13px] font-medium text-ink-3">今日吃什么</p>
        {picks.length === 0 ? (
          <div className="mt-2 rounded-xl bg-surface px-4 py-6 text-center text-[13px] leading-5 text-ink-2">
            菜谱库还空着——去「菜谱」Tab 看看，或从管理端导入几道拿手菜。
          </div>
        ) : (
          <div className="mt-2 space-y-2">
            {picks.map((recipe, index) => (
              <Link
                key={recipe.id}
                href={`/recipes/${encodeURIComponent(recipe.id)}`}
                className="flex items-center gap-3.5 rounded-xl bg-surface px-4 py-3.5 transition active:bg-fill"
              >
                <span
                  className={`flex size-11 shrink-0 items-center justify-center rounded-lg text-[17px] ${
                    index === 0 ? 'bg-tint-soft text-tint-deep' : 'bg-fill text-ink-2'
                  }`}
                >
                  {index === 0 ? '开' : '荐'}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[16px] font-semibold text-ink">{recipe.title}</span>
                  <span className="mt-0.5 block text-[12px] text-ink-3">
                    约 {recipe.minutes} 分钟
                    {recipe.tags.length > 0 && ` · ${recipe.tags.slice(0, 2).join(' / ')}`}
                  </span>
                </span>
                <span className="shrink-0 text-ink-3/60">
                  <IconChevronRight className="size-4" />
                </span>
              </Link>
            ))}
          </div>
        )}
        <Link
          href="/recipes"
          className="mt-2.5 flex items-center justify-center gap-1 py-1 text-[13px] font-medium text-tint active:opacity-60"
        >
          换换口味，逛逛全部菜谱
          <IconChevronRight className="size-3.5" />
        </Link>
      </section>

      {/* 次级：最近做过的（登录后出现） */}
      <RecentCooks />

      {/* 快速决策入口：清冰箱做菜 */}
      <section className="px-4 pt-5">
        <Link
          href="/fridge"
          className="flex items-center gap-3.5 rounded-xl bg-surface px-4 py-3.5 transition active:bg-fill"
        >
          <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-tint-soft text-tint-deep">
            <IconFridge className="size-5.5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[16px] font-semibold text-ink">看看冰箱能做什么</span>
            <span className="mt-0.5 block text-[12px] text-ink-3">报上现有食材，马上告诉你能开做什么菜</span>
          </span>
          <span className="shrink-0 text-ink-3/60">
            <IconChevronRight className="size-4" />
          </span>
        </Link>
      </section>
    </div>
  )
}
