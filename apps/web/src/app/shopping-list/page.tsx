'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import type { ShoppingListItem } from '@kaifan/shared'
import { useAuth } from '@/components/auth-provider'
import { ShoppingListView } from './shopping-list-view'

export default function ShoppingListPage() {
  const { user, loading: authLoading, getAccessToken } = useAuth()
  const [listId, setListId] = useState<string | null>(null)
  const [items, setItems] = useState<ShoppingListItem[]>([])
  const [fetching, setFetching] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      setFetching(false)
      return
    }

    const loadShoppingList = async () => {
      setFetching(true)
      try {
        const token = await getAccessToken()
        if (!token) return

        const res = await fetch('/api/shopping-lists', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })
        const body = (await res.json()) as {
          list?: { id: string } | null
          items?: ShoppingListItem[]
          error?: string
        }

        if (!res.ok) {
          throw new Error(body.error || '加载购物清单失败')
        }

        setListId(body.list?.id || null)
        setItems(body.items || [])
      } catch (err) {
        setError((err as Error).message)
      } finally {
        setFetching(false)
      }
    }

    void loadShoppingList()
  }, [user, authLoading, getAccessToken])

  if (authLoading || fetching) {
    return (
      <main className="mx-auto min-h-dvh w-full max-w-md px-5 pt-10 pb-16 text-center text-xs text-ink/50">
        正在拉取购物清单…
      </main>
    )
  }

  if (!user) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center px-6 text-center">
        <div className="text-4xl mb-3">🛒</div>
        <h1 className="mb-2 text-xl font-bold">需要先登录</h1>
        <p className="mb-6 text-sm text-ink/60">购物清单与你的账号绑定，跨设备随时买菜勾选</p>
        <Link
          href="/login"
          className="rounded-xl bg-brand px-6 py-3 font-semibold text-white shadow-sm"
        >
          前往登录 / 注册
        </Link>
      </main>
    )
  }

  return (
    <main className="mx-auto min-h-dvh w-full max-w-md px-5 pt-10 pb-16">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <Link href="/" className="mb-1 inline-block text-xs text-ink/50">
            ← 返回首页
          </Link>
          <h1 className="text-xl font-bold">🛒 购物清单</h1>
          <p className="text-xs text-ink/60">买菜/厨房备料 · 点击勾选已备齐</p>
        </div>
      </header>

      {error && (
        <p className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          {error}
        </p>
      )}

      <ShoppingListView
        initialListId={listId}
        initialItems={items}
        getAccessToken={getAccessToken}
      />
    </main>
  )
}
