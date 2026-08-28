import Link from 'next/link'

import { SAMPLE_RECIPES } from '@kaifan/shared'

import { IconChevronRight, IconFridge, IconPlus } from '@/components/icons'
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
    <div className="mx-auto w-full max-w-md pb-24">
      {/* 顶部：日期 · 问候 +「今晚吃什么」大标题 */}
      <HomeGreeting />

      {/* 核心第一入口：清冰箱智能匹配 */}
      <section className="px-4">
        <Link
          href="/fridge"
          className="flex items-center gap-3.5 rounded-xl bg-surface px-4 py-3.5 transition active:bg-fill"
        >
          <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-tint-soft text-tint-deep">
            <IconFridge className="size-5.5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-semibold text-ink">看看冰箱能做什么</span>
            <span className="mt-0.5 block text-[12px] text-ink-3">点选现有食材，立刻告诉你马上能开做什么菜</span>
          </span>
          <span className="shrink-0 text-ink-3/60">
            <IconChevronRight className="size-4" />
          </span>
        </Link>
      </section>

      {/* 今日推荐精选 */}
      <section className="px-4 pt-6">
        <div className="flex items-center justify-between px-1 mb-2">
          <p className="text-[13px] font-medium text-ink-3">今日推荐</p>
          {picks.length > 0 && (
            <Link href="/recipes" className="text-[12px] font-medium text-tint active:opacity-60">
              全部菜谱
            </Link>
          )}
        </div>

        {picks.length === 0 ? (
          <div className="rounded-xl bg-surface p-6 text-center space-y-3">
            <p className="text-[15px] font-semibold text-ink">还没有录入菜谱</p>
            <p className="text-[13px] leading-5 text-ink-3">
              添加属于你的第一道拿手菜，开启专属每日菜单
            </p>
            <Link
              href="/recipes/new"
              className="inline-flex items-center gap-1 rounded-xl bg-tint px-4 py-2 text-[13px] font-semibold text-white active:opacity-70"
            >
              <IconPlus className="size-4" />
              <span>添加第一道菜</span>
            </Link>
          </div>
        ) : (
          <div className="list-group">
            {picks.map((recipe, index) => {
              const isLast = index === picks.length - 1
              return (
                <Link
                  key={recipe.id}
                  href={`/recipes/${encodeURIComponent(recipe.id)}`}
                  className={`flex items-center gap-3.5 px-4 py-3.5 transition-colors active:bg-fill ${
                    isLast ? '' : 'border-b border-line'
                  }`}
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-tint-soft text-[15px] font-bold text-tint-deep">
                    {recipe.title.slice(0, 1)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold text-ink">{recipe.title}</span>
                    <span className="mt-0.5 block text-[12px] text-ink-3">
                      约 {recipe.minutes} 分钟
                      {recipe.tags.length > 0 && ` · ${recipe.tags.slice(0, 2).join(' / ')}`}
                    </span>
                  </span>
                  <span className="shrink-0 text-ink-3/60">
                    <IconChevronRight className="size-4" />
                  </span>
                </Link>
              )
            })}
          </div>
        )}
      </section>

      {/* 次级：最近做过的菜（登录态下展示） */}
      <RecentCooks />
    </div>
  )
}
