'use client'

import Link from 'next/link'
import { useAuth } from '@/components/auth-provider'
import { RecipeEditorForm } from '@/components/recipe-editor-form'
import { LoginRequired, NavBar } from '@/components/ui'

export default function NewRecipePage() {
  const { user, loading } = useAuth()

  if (loading) {
    return <main className="screen text-center text-xs text-ink-3 pt-20">加载中…</main>
  }

  if (!user) {
    return (
      <LoginRequired
        glyph="📖"
        title="需要先登录"
        description="自建菜谱将保存在你的个人名下，发布后全站可见"
      />
    )
  }

  return (
    <div className="screen">
      <NavBar title="自建拿手菜" back="/recipes" backLabel="菜谱" />
      <div className="mt-4">
        <RecipeEditorForm />
      </div>
    </div>
  )
}
