'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import type { ShoppingListItem } from '@kaifan/shared'
import { useAuth } from '@/components/auth-provider'
import { ShoppingListView } from './shopping-list-view'

const GUEST_STORAGE_KEY = 'kaifan_guest_shopping_list'

function loadGuestItems(): ShoppingListItem[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(GUEST_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export default function ShoppingListPage() {
  const { user, loading: authLoading, getAccessToken } = useAuth()
  const [listId, setListId] = useState<string | null>(null)
  const [items, setItems] = useState<ShoppingListItem[]>([])
  const [fetching, setFetching] = useState(true)
  const [error, setError] = useState('')
  const [guestMergeNotice, setGuestMergeNotice] = useState('')

  useEffect(() => {
    if (authLoading) return

    // 1. 游客模式（未登录）：直接读取本地 LocalStorage 清单
    if (!user) {
      setItems(loadGuestItems())
      setListId(null)
      setFetching(false)
      return
    }

    // 2. 登录模式：若本地有离线临时清单，自动发起合并
    const loadAndSyncShoppingList = async () => {
      setFetching(true)
      setError('')
      try {
        const token = await getAccessToken()
        if (!token) return

        const guestItems = loadGuestItems()
        if (guestItems.length > 0) {
          // 自动同步离线清单到云端
          const mergeRes = await fetch('/api/shopping-lists', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ items: guestItems, mode: 'append' }),
          })

          if (mergeRes.ok) {
            localStorage.removeItem(GUEST_STORAGE_KEY)
            setGuestMergeNotice(`已将本地离线备料清单（${guestItems.length} 项）自动合并至云端账号 ✓`)
          }
        }

        // 拉取最新云端清单
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

    void loadAndSyncShoppingList()
  }, [user, authLoading, getAccessToken])

  if (authLoading || fetching) {
    return (
      <main className="mx-auto min-h-dvh w-full max-w-md px-5 pt-10 pb-16 text-center text-xs text-ink/50">
        正在拉取购物清单…
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

      {/* 游客模式提示栏 */}
      {!user && (
        <div className="mb-4 rounded-xl border border-brand/20 bg-brand-soft/60 p-3 text-xs leading-5 text-ink/70">
          💡 <span className="font-semibold text-ink">当前为离线免登录模式</span>：清单已保存在本机浏览器中。
          <Link href="/login" className="ml-1 font-semibold text-brand underline">
            登录 / 注册
          </Link>
          后可跨设备随时同步并自动合并。
        </div>
      )}

      {guestMergeNotice && (
        <p className="mb-4 rounded-xl border border-green-200 bg-green-50 p-3 text-xs text-green-700">
          {guestMergeNotice}
        </p>
      )}

      {error && (
        <p className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          {error}
        </p>
      )}

      <ShoppingListView
        initialListId={listId}
        initialItems={items}
        isGuest={!user}
        getAccessToken={getAccessToken}
      />
    </main>
  )
}
