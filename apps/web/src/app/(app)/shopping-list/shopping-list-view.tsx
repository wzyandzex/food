'use client'

import { useRef, useState } from 'react'
import type { ShoppingListItem } from '@kaifan/shared'
import { IconCheck, IconPlus, IconX } from '@/components/icons'

const GUEST_STORAGE_KEY = 'kaifan_guest_shopping_list'

interface ShoppingListViewProps {
  initialListId: string | null
  initialItems: ShoppingListItem[]
  isGuest?: boolean
  getAccessToken: () => Promise<string | null>
}

export function ShoppingListView({
  initialListId,
  initialItems,
  isGuest = false,
  getAccessToken,
}: ShoppingListViewProps) {
  const [listId, setListId] = useState<string | null>(initialListId)
  const [items, setItems] = useState<ShoppingListItem[]>(initialItems)
  const [inputName, setInputName] = useState('')
  const [inputQty, setInputQty] = useState('')
  const [inputUnit, setInputUnit] = useState('')
  const [isAdding, setIsAdding] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  const latestItemsRef = useRef(items)
  latestItemsRef.current = items
  const isPersistingRef = useRef(false)
  const pendingPersistRef = useRef(false)

  const pendingItems = items.filter((item) => !item.checked)
  const checkedItems = items.filter((item) => item.checked)
  const totalCount = items.length
  const progress = totalCount > 0 ? Math.round((checkedItems.length / totalCount) * 100) : 0

  const persistItems = async (updatedItems: ShoppingListItem[]) => {
    if (isGuest) {
      try {
        localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(updatedItems))
      } catch (err) {
        console.error('保存本地离线清单失败：', err)
      }
      return
    }

    if (isPersistingRef.current) {
      pendingPersistRef.current = true
      return
    }

    isPersistingRef.current = true
    setSyncing(true)
    setError('')

    try {
      const token = await getAccessToken()
      if (!token) return

      const itemsToSend = latestItemsRef.current

      if (listId) {
        const res = await fetch(`/api/shopping-lists/${listId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ items: itemsToSend }),
        })
        if (!res.ok) {
          const body = (await res.json()) as { error?: string }
          throw new Error(body.error || '保存清单失败')
        }
      } else {
        const res = await fetch('/api/shopping-lists', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ items: itemsToSend, mode: 'replace' }),
        })
        const body = (await res.json()) as { listId?: string; error?: string }
        if (!res.ok || !body.listId) throw new Error(body.error || '创建清单失败')
        setListId(body.listId)
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      isPersistingRef.current = false
      setSyncing(false)
      if (pendingPersistRef.current) {
        pendingPersistRef.current = false
        void persistItems(latestItemsRef.current)
      }
    }
  }

  const toggleItem = (id: string) => {
    const updated = items.map((item) =>
      item.id === id ? { ...item, checked: !item.checked } : item,
    )
    setItems(updated)
    void persistItems(updated)
  }

  const removeItem = (id: string) => {
    const updated = items.filter((item) => item.id !== id)
    setItems(updated)
    void persistItems(updated)
  }

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault()
    const name = inputName.trim()
    if (!name) return

    const qty = inputQty ? Number(inputQty) : null
    const unit = inputUnit.trim()

    const newItem: ShoppingListItem = {
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `item_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name,
      qty: qty && qty > 0 ? qty : null,
      unit: unit || '',
      checked: false,
    }

    const updated = [newItem, ...items]
    setItems(updated)
    setInputName('')
    setInputQty('')
    setInputUnit('')
    setIsAdding(false)
    void persistItems(updated)
  }

  const handleClearChecked = () => {
    if (checkedItems.length === 0) return
    const updated = items.filter((item) => !item.checked)
    setItems(updated)
    void persistItems(updated)
  }

  const handleCopyWeChat = async () => {
    if (pendingItems.length === 0) {
      alert('待采清单为空')
      return
    }

    const lines = [
      '🛒【开饭·今日买菜清单】',
      ...pendingItems.map((item, index) => {
        const qtyStr = item.qty ? `${item.qty} ${item.unit}`.trim() : item.unit || '适量'
        const fromStr = item.sourceRecipeTitle ? `（用于 ${item.sourceRecipeTitle}）` : ''
        return `${index + 1}. ${item.name}：${qtyStr}${fromStr}`
      }),
      '—————————————',
      '点击进入开饭可实时勾选备齐：https://kaifan.app/shopping-list',
    ]

    try {
      await navigator.clipboard.writeText(lines.join('\n'))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      alert('复制失败，请手动复制')
    }
  }

  return (
    <div className="space-y-4">
      {/* 进度与操作 */}
      <section className="card p-4 space-y-2.5">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[12px] text-ink-3">备料进度</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-[22px] font-bold text-ink">{checkedItems.length}</span>
              <span className="text-[12px] text-ink-3">/ {totalCount} 项备齐</span>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleCopyWeChat}
              disabled={pendingItems.length === 0}
              className="rounded-lg bg-fill px-3 py-1.5 text-[12px] font-semibold text-ink-2 active:bg-fill-strong disabled:opacity-40"
            >
              {copied ? '✓ 已复制' : '📋 发给微信'}
            </button>
            <button
              type="button"
              onClick={() => setIsAdding(!isAdding)}
              className="flex items-center gap-0.5 rounded-lg bg-tint px-3 py-1.5 text-[12px] font-semibold text-white active:opacity-70"
            >
              <IconPlus className="size-3.5" />
              <span>{isAdding ? '取消' : '加项'}</span>
            </button>
          </div>
        </div>

        {totalCount > 0 && (
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-fill">
            <div className="h-full bg-tint transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
        )}
      </section>

      {/* 手动加项表单 */}
      {isAdding && (
        <form onSubmit={handleAddItem} className="card p-4 space-y-2.5">
          <p className="text-[13px] font-semibold text-ink">添加条目</p>
          <input
            type="text"
            value={inputName}
            onChange={(e) => setInputName(e.target.value)}
            placeholder="食材名称（如：生姜、大葱）"
            className="field text-[13px]"
            required
            autoFocus
          />
          <div className="flex gap-2">
            <input
              type="number"
              step="any"
              value={inputQty}
              onChange={(e) => setInputQty(e.target.value)}
              placeholder="数量"
              className="field flex-1 text-[13px]"
            />
            <input
              type="text"
              value={inputUnit}
              onChange={(e) => setInputUnit(e.target.value)}
              placeholder="单位（克/根/个）"
              className="field w-28 text-[13px]"
            />
          </div>
          <button type="submit" className="btn-primary py-2.5 text-[13px]">
            加入清单
          </button>
        </form>
      )}

      {error && <p className="card p-3 text-[12px] text-danger bg-danger-soft">{error}</p>}

      {/* 待采清单 */}
      <section>
        <div className="flex items-center justify-between px-1 mb-1.5">
          <h2 className="text-[13px] font-medium text-ink-3">待采购 / 待准备（{pendingItems.length}）</h2>
          {syncing && <span className="text-[11px] text-tint">保存中…</span>}
        </div>

        {pendingItems.length === 0 ? (
          <div className="card p-6 text-center text-[13px] text-ink-3">
            {totalCount === 0 ? '清单空空如也，从菜谱或点单导入吧' : '🎉 所有食材已备齐！'}
          </div>
        ) : (
          <div className="list-group">
            {pendingItems.map((item, idx) => {
              const isLast = idx === pendingItems.length - 1
              return (
                <div
                  key={item.id}
                  onClick={() => toggleItem(item.id)}
                  className={`flex cursor-pointer select-none items-center justify-between px-4 py-3 text-[14px] transition-colors active:bg-fill ${
                    isLast ? '' : 'border-b border-line'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex size-4.5 items-center justify-center rounded border border-ink-3/40 bg-surface" />
                    <div>
                      <span className="font-medium text-ink">{item.name}</span>
                      {item.sourceRecipeTitle && (
                        <span className="ml-1.5 rounded bg-fill px-1.5 py-0.5 text-[10px] text-ink-3">
                          {item.sourceRecipeTitle}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-tint-deep text-[13px]">
                      {item.qty ? `${item.qty} ${item.unit}`.trim() : item.unit || '适量'}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        removeItem(item.id)
                      }}
                      className="p-1 text-ink-3 hover:text-danger"
                      aria-label="删除"
                    >
                      <IconX className="size-3.5" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* 已备齐清单 */}
      {checkedItems.length > 0 && (
        <section>
          <div className="flex items-center justify-between px-1 mb-1.5">
            <h2 className="text-[13px] font-medium text-ink-3">已备齐（{checkedItems.length}）</h2>
            <button type="button" onClick={handleClearChecked} className="text-[12px] text-danger hover:underline">
              清除已备齐
            </button>
          </div>

          <div className="list-group opacity-60">
            {checkedItems.map((item, idx) => {
              const isLast = idx === checkedItems.length - 1
              return (
                <div
                  key={item.id}
                  onClick={() => toggleItem(item.id)}
                  className={`flex cursor-pointer select-none items-center justify-between px-4 py-2.5 text-[13px] text-ink-3 line-through ${
                    isLast ? '' : 'border-b border-line'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex size-4.5 items-center justify-center rounded border border-success bg-success text-white">
                      <IconCheck className="size-3" />
                    </div>
                    <span>{item.name}</span>
                  </div>
                  <span>{item.qty ? `${item.qty} ${item.unit}`.trim() : item.unit || ''}</span>
                </div>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}
