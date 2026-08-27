'use client'

import Link from 'next/link'
import { useAuth } from '@/components/auth-provider'
import { RecipeEditorForm } from '@/components/recipe-editor-form'

export default function NewRecipePage() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <main className="mx-auto min-h-dvh w-full max-w-md px-5 pt-10 pb-16 text-center text-xs text-ink/50">
        加载中…
      </main>
    )
  }

  if (!user) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center px-6 text-center">
        <div className="mb-3 text-4xl">📖</div>
        <h1 className="mb-2 text-xl font-bold">需要先登录</h1>
        <p className="mb-6 text-sm text-ink/60">自建菜谱将保存在你的个人名下，发布后全站可见</p>
        <Link href="/login" className="rounded-xl bg-brand px-6 py-3 font-semibold text-white shadow-sm">
          前往登录 / 注册
        </Link>
      </main>
    )
  }

  return (
    <main className="mx-auto min-h-dvh w-full max-w-md px-5 pt-10 pb-16">
      <header className="mb-5">
        <Link href="/recipes" className="mb-1 inline-block text-xs text-ink/50">← 返回菜谱市场</Link>
        <h1 className="text-xl font-bold">✍️ 自建拿手菜</h1>
        <p className="text-xs text-ink/60">录入你的专属做法，后续记做饭、发点单都能直接调用</p>
      </header>

      <RecipeEditorForm />
    </main>
  )
}
