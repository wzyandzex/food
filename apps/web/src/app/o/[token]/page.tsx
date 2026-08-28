import Link from 'next/link'
import { createServerClient } from '@/lib/supabase'
import { ORDER_SESSION_STATUS_LABELS, type OrderSessionStatus } from '@kaifan/shared'
import OrderForm from './order-form'

interface RecipeBrief {
  id: string
  title: string
  minutes: number
  difficulty: number
}

type SessionState =
  | { kind: 'invalid' }
  | {
      kind: 'ok'
      locked: boolean
      lockReason: string
      title: string
      hostNickname: string
      deadline: string
      status: string
      perPersonLimit: number
      allowFreeInput: boolean
      recipes: RecipeBrief[]
    }

async function getOrderSession(token: string): Promise<SessionState> {
  const supabase = createServerClient()

  const { data: tokenRow, error: tokenError } = await supabase
    .from('share_tokens')
    .select(
      'order_session_id, expires_at, revoked, order_sessions(id, title, deadline, status, per_person_limit, allow_free_input, candidate_recipe_ids, profiles(nickname))',
    )
    .eq('token', token)
    .maybeSingle()

  if (tokenError || !tokenRow || tokenRow.revoked) return { kind: 'invalid' }
  if (new Date(tokenRow.expires_at).getTime() <= Date.now()) return { kind: 'invalid' }

  const session = tokenRow.order_sessions as unknown as {
    id: string
    title: string
    deadline: string
    status: string
    per_person_limit: number
    allow_free_input: boolean
    candidate_recipe_ids: string[] | null
    profiles: { nickname: string } | null
  } | null

  if (!session) return { kind: 'invalid' }

  if (session.status !== 'open') {
    const label = ORDER_SESSION_STATUS_LABELS[session.status as OrderSessionStatus] ?? session.status
    return {
      kind: 'ok', locked: true, lockReason: `这场点单已${label}`, title: session.title,
      hostNickname: session.profiles?.nickname || '主厨', deadline: session.deadline,
      status: session.status, perPersonLimit: session.per_person_limit,
      allowFreeInput: false, recipes: [],
    }
  }
  if (new Date(session.deadline).getTime() <= Date.now()) {
    return {
      kind: 'ok', locked: true, lockReason: '已超过截止时间，点单已截止',
      title: session.title, hostNickname: session.profiles?.nickname || '主厨',
      deadline: session.deadline, status: session.status,
      perPersonLimit: session.per_person_limit, allowFreeInput: false, recipes: [],
    }
  }

  let candidateRecipes: RecipeBrief[] = []
  const candidateIds = session.candidate_recipe_ids ?? []
  if (candidateIds.length > 0) {
    const { data: recipes, error: recipesError } = await supabase
      .from('recipes')
      .select('id, title, minutes, difficulty')
      .in('id', candidateIds)
      .eq('status', 'published')
      .is('deleted_at', null)

    if (!recipesError) {
      candidateRecipes = (recipes as RecipeBrief[]) ?? []
    }
  }

  return {
    kind: 'ok',
    locked: false,
    lockReason: '',
    title: session.title,
    hostNickname: session.profiles?.nickname || '主厨',
    deadline: session.deadline,
    status: session.status,
    perPersonLimit: session.per_person_limit,
    allowFreeInput: session.allow_free_input,
    recipes: candidateRecipes,
  }
}

export default async function OrderSharePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const state = await getOrderSession(token)

  if (state.kind === 'invalid') {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center px-6 text-center">
        <p className="mb-3 text-[44px]">🔗</p>
        <h1 className="text-[18px] font-bold text-ink">点单链接已失效</h1>
        <p className="mt-2 mb-6 max-w-xs text-[13px] leading-5 text-ink-3">
          这场点单可能已结束，或链接已过期。<br />
          让发起人重新分享一个新链接吧。
        </p>
        <Link href="/" className="btn-tonal w-auto px-6 py-2.5 text-[14px]">
          去看看开饭首页
        </Link>
      </main>
    )
  }

  return (
    <main className="mx-auto min-h-dvh w-full max-w-md px-5 pt-8 pb-16">
      {/* 头部信息 */}
      <header className="card p-5 text-center space-y-1">
        <p className="text-[32px]">👨‍🍳</p>
        <h1 className="text-[18px] font-bold text-ink">{state.title}</h1>
        <p className="text-[12px] text-ink-3">
          {state.hostNickname} 邀请你点菜 · 截止{' '}
          {new Date(state.deadline).toLocaleString('zh-CN', {
            month: 'numeric',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
      </header>

      {state.locked ? (
        <section className="card mt-4 p-8 text-center space-y-2">
          <p className="text-[36px]">⏰</p>
          <h2 className="text-[15px] font-semibold text-ink">{state.lockReason}</h2>
          <p className="text-[12px] text-ink-3">
            想改点别的？直接跟 {state.hostNickname} 说一声吧。
          </p>
        </section>
      ) : (
        <div className="mt-4">
          <OrderForm
            token={token}
            perPersonLimit={state.perPersonLimit}
            allowFreeInput={state.allowFreeInput}
            recipes={state.recipes}
          />
        </div>
      )}

      <footer className="mt-8 text-center text-[11px] text-ink-3">
        <Link href="/" className="underline">
          由 开饭 KaiFan 提供点单支持
        </Link>
      </footer>
    </main>
  )
}
