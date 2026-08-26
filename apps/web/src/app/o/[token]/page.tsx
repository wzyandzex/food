import Link from 'next/link'
import { notFound } from 'next/navigation'
import { SAMPLE_RECIPES } from '@kaifan/shared'

import { createServerClient } from '@/lib/supabase'
import OrderForm from './order-form'

interface RecipeBrief {
  id: string
  title: string
  minutes: number
  difficulty: number
}

async function getOrderSession(token: string) {
  try {
    const supabase = createServerClient()
    const { data: tokenRow } = await supabase
      .from('share_tokens')
      .select('order_session_id, expires_at, revoked, order_sessions(id, title, deadline, status, per_person_limit, allow_free_input, candidate_recipe_ids, profiles(nickname))')
      .eq('token', token)
      .single()

    if (!tokenRow || tokenRow.revoked) return null

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const session = tokenRow.order_sessions as any
    if (!session) return null

    // 查询候选菜谱详情
    let candidateRecipes: RecipeBrief[] = []
    if (session.candidate_recipe_ids && session.candidate_recipe_ids.length > 0) {
      const { data: recipes } = await supabase
        .from('recipes')
        .select('id, title, minutes, difficulty')
        .in('id', session.candidate_recipe_ids)
      candidateRecipes = (recipes as RecipeBrief[]) || []
    }

    if (candidateRecipes.length === 0) {
      candidateRecipes = SAMPLE_RECIPES.map((r) => ({
        id: r.title,
        title: r.title,
        minutes: r.minutes,
        difficulty: r.difficulty,
      }))
    }

    return {
      title: session.title,
      deadline: session.deadline,
      status: session.status,
      perPersonLimit: session.per_person_limit,
      allowFreeInput: session.allow_free_input,
      hostNickname: session.profiles?.nickname || '主厨',
      recipes: candidateRecipes,
    }
  } catch {
    // 降级兜底预览
    return {
      title: '今晚吃什么？',
      deadline: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
      status: 'open',
      perPersonLimit: 3,
      allowFreeInput: true,
      hostNickname: '主厨',
      recipes: SAMPLE_RECIPES.map((r) => ({
        id: r.title,
        title: r.title,
        minutes: r.minutes,
        difficulty: r.difficulty,
      })),
    }
  }
}

export default async function OrderSharePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const session = await getOrderSession(token)

  if (!session) notFound()

  return (
    <main className="mx-auto min-h-dvh w-full max-w-md px-5 pt-8 pb-16">
      <header className="mb-6 rounded-2xl bg-white p-5 shadow-sm text-center">
        <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-2xl bg-brand text-2xl">
          👨‍🍳
        </div>
        <h1 className="text-xl font-bold">{session.title}</h1>
        <p className="text-xs text-ink/60 mt-1">
          {session.hostNickname} 邀请你点菜 · 截止 {new Date(session.deadline).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
        </p>
      </header>

      <OrderForm
        token={token}
        perPersonLimit={session.perPersonLimit}
        allowFreeInput={session.allowFreeInput}
        recipes={session.recipes}
      />

      <footer className="mt-8 text-center text-xs text-ink/40">
        <Link href="/" className="underline">
          由 开饭 KaiFan 提供点单支持
        </Link>
      </footer>
    </main>
  )
}
