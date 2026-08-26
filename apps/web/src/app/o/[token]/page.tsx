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

  // 不存在/已撤销/已过期：统一按链接失效处理（口径与 submit 一致）
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

  // 截止时间已过或会话已不在收集阶段 → 只读展示，不再渲染可填表单
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

  // 查询候选菜谱详情；候选 id 非法或查不到时降级为「仅自由报菜名」，不伪造菜单
  let candidateRecipes: RecipeBrief[] = []
  const candidateIds = session.candidate_recipe_ids ?? []
  if (candidateIds.length > 0) {
    const { data: recipes, error: recipesError } = await supabase
      .from('recipes')
      .select('id, title, minutes, difficulty')
      .in('id', candidateIds)
      .eq('status', 'published')
      .is('deleted_at', null)

    if (recipesError) {
      console.error('候选菜谱查询失败：', recipesError.message)
    } else {
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

  // 友好失效页：让访客知道该做什么，而不是 404 或假页面（PRD §6 边界场景 1）
  if (state.kind === 'invalid') {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center px-6 text-center">
        <div className="mb-4 text-5xl">🔗</div>
        <h1 className="mb-2 text-lg font-bold">点单链接已失效</h1>
        <p className="mb-6 text-sm leading-6 text-ink/60">
          这场点单可能已结束，或链接已过期。<br />
          让发起人重新分享一个新链接吧。
        </p>
        <Link href="/" className="rounded-xl bg-brand px-6 py-3 text-sm font-semibold text-white shadow-sm">
          去看看开饭首页
        </Link>
      </main>
    )
  }

  return (
    <main className="mx-auto min-h-dvh w-full max-w-md px-5 pt-8 pb-16">
      <header className="mb-6 rounded-2xl bg-white p-5 shadow-sm text-center">
        <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-2xl bg-brand text-2xl">
          👨‍🍳
        </div>
        <h1 className="text-xl font-bold">{state.title}</h1>
        <p className="text-xs text-ink/60 mt-1">
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
        <section className="rounded-2xl bg-white p-8 text-center shadow-sm space-y-3">
          <div className="text-4xl">⏰</div>
          <h2 className="text-sm font-semibold">{state.lockReason}</h2>
          <p className="text-xs text-ink/50 leading-5">
            想改点别的？直接跟 {state.hostNickname} 说一声吧。
          </p>
        </section>
      ) : (
        <OrderForm
          token={token}
          perPersonLimit={state.perPersonLimit}
          allowFreeInput={state.allowFreeInput}
          recipes={state.recipes}
        />
      )}

      <footer className="mt-8 text-center text-xs text-ink/40">
        <Link href="/" className="underline">
          由 开饭 KaiFan 提供点单支持
        </Link>
      </footer>
    </main>
  )
}
