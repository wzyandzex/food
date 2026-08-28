'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import type { ShoppingListItem } from '@kaifan/shared'
import { useAuth } from '@/components/auth-provider'
import { NavBar } from '@/components/ui'
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

    if (!user) {
      setItems(loadGuestItems())
      setListId(null)
      setFetching(false)
      return
    }

    const loadAndSyncShoppingList = async () => {
      setFetching(true)
      setError('')
      try {
        const token = await getAccessToken()
        if (!token) return

        const guestItems = loadGuestItems()
        if (guestItems.length > 0) {
          const mergeRes = await fetch('/api/shopping-lists', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ items: guestItems, mode: 'append' }),
          })
          if (mergeRes.ok) {
            localStorage.removeItem(GUEST_STORAGE_KEY)
            setGuestMergeNotice(`已自动合并本地离线清单（${guestItems.length} 项）`)
          }
        }

        const res = await fetch('/api/shopping-lists', { headers: { Authorization: `Bearer ${token}` } })
        const body = (await res.json()) as { list?: { id: string } | null; items?: ShoppingListItem[]; error?: string }
        if (!res.ok) throw new Error(body.error || '加载购物清单失败')

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
    return <main className="screen text-center text-xs text-ink-3 pt-20">正在拉取购物清单…</main>
  }

  return (
    <div className="screen">
      <NavBar title="购物清单" back="/me" backLabel="我的" />

      {!user && (
        <div className="mt-3 rounded-xl bg-tint-soft p-3 text-[12px] leading-5 text-tint-deep">
          💡 <strong>离线模式</strong>：清单已保存在本机。
          <Link href="/login" className="underline font-semibold ml-1">登录</Link> 后可跨设备同步。
        </div>
      )}

      {guestMergeNotice && (
        <p className="mt-3 rounded-xl bg-success-soft p-3 text-[12px] text-success">
          {guestMergeNotice}
        </p>
      )}

      {error && (
        <p className="mt-3 rounded-xl bg-danger-soft p-3 text-[12px] text-danger">{error}</p>
      )}

      <div className="mt-4">
        <ShoppingListView
          initialListId={listId}
          initialItems={items}
          isGuest={!user}
          getAccessToken={getAccessToken}
        />
      </div>
    </div>
  )
}
