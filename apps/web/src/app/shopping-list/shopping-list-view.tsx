'use client'

import { useRef, useState } from 'react'
import type { ShoppingListItem } from '@kaifan/shared'

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

  // 竞态队列锁：确保高频连续点击时，最新的 items 始终能够排队串行落盘
  const latestItemsRef = useRef(items)
  latestItemsRef.current = items
  const isPersistingRef = useRef(false)
  const pendingPersistRef = useRef(false)

  const pendingItems = items.filter((item) => !item.checked)
  const checkedItems = items.filter((item) => item.checked)
  const totalCount = items.length
  const progress = totalCount > 0 ? Math.round((checkedItems.length / totalCount) * 100) : 0

  // 统一持久化更新（支持游客 LocalStorage 与登录端 API 串行落盘）
  const persistItems = async (updatedItems: ShoppingListItem[]) => {
    // 1. 游客模式：直接同步 LocalStorage
    if (isGuest) {
      try {
        localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(updatedItems))
      } catch (err) {
        console.error('保存本地离线清单失败：', err)
      }
      return
    }

    // 2. 登录模式：排队机制防止并发写入产生状态覆盖
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
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ items: itemsToSend }),
        })
        if (!res.ok) {
          const body = (await res.json()) as { error?: string }
          throw new Error(body.error || '保存清单失败')
        }
      } else {
        // 尚未建清单时，POST 创建
        const res = await fetch('/api/shopping-lists', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ items: itemsToSend, mode: 'replace' }),
        })
        const body = (await res.json()) as { listId?: string; error?: string }
        if (!res.ok || !body.listId) {
          throw new Error(body.error || '创建清单失败')
        }
        setListId(body.listId)
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      isPersistingRef.current = false
      setSyncing(false)
      // 若在请求中途又有新的修改入队，继续触发下一次落盘
      if (pendingPersistRef.current) {
        pendingPersistRef.current = false
        void persistItems(latestItemsRef.current)
      }
    }
  }

  // 1. 切换勾选状态（乐观更新）
  const toggleItem = (id: string) => {
    const updated = items.map((item) =>
      item.id === id ? { ...item, checked: !item.checked } : item,
    )
    setItems(updated)
    void persistItems(updated)
  }

  // 2. 删除单项
  const removeItem = (id: string) => {
    const updated = items.filter((item) => item.id !== id)
    setItems(updated)
    void persistItems(updated)
  }

  // 3. 手动新增食材
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

  // 4. 清空已备齐的食材
  const handleClearChecked = () => {
    if (checkedItems.length === 0) return
    const updated = items.filter((item) => !item.checked)
    setItems(updated)
    void persistItems(updated)
  }

  // 5. 复制生成微信买菜清单文本
  const handleCopyWeChat = async () => {
    if (pendingItems.length === 0) {
      alert('待采清单为空，无需买菜啦！')
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

    const text = lines.join('\n')

    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      alert('复制失败，请手动复制')
    }
  }

  return (
    <div className="space-y-5">
      {/* 进度与快捷动作卡片 */}
      <section className="rounded-2xl bg-white p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-ink/70">备料进度</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-2xl font-bold text-ink">{checkedItems.length}</span>
              <span className="text-xs text-ink/40">/ {totalCount} 项备齐</span>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleCopyWeChat}
              disabled={pendingItems.length === 0}
              className="rounded-xl bg-brand-soft px-3 py-2 text-xs font-semibold text-brand-deep active:scale-95 disabled:opacity-40"
            >
              {copied ? '✓ 已复制文本' : '📋 发给微信'}
            </button>
            <button
              type="button"
              onClick={() => setIsAdding(!isAdding)}
              className="rounded-xl bg-brand px-3.5 py-2 text-xs font-semibold text-white shadow-sm active:scale-95"
            >
              {isAdding ? '取消' : '+ 加项'}
            </button>
          </div>
        </div>

        {/* 进度条 */}
        {totalCount > 0 && (
          <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-100">
            <div
              className="h-full bg-brand transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </section>

      {/* 手动加项表单 */}
      {isAdding && (
        <form
          onSubmit={handleAddItem}
          className="rounded-2xl bg-white p-5 shadow-sm space-y-3 border border-brand/20 animate-in fade-in duration-200"
        >
          <h2 className="text-xs font-bold text-ink/80">添加买菜 / 备料条目</h2>
          <div className="space-y-2">
            <input
              type="text"
              value={inputName}
              onChange={(e) => setInputName(e.target.value)}
              placeholder="食材名称（如：生姜、大葱、鸡胸肉）"
              className="w-full rounded-xl border border-neutral-200 px-3.5 py-2.5 text-xs outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
              required
              autoFocus
            />
            <div className="flex gap-2">
              <input
                type="number"
                step="any"
                value={inputQty}
                onChange={(e) => setInputQty(e.target.value)}
                placeholder="数量（选填，如 500）"
                className="flex-1 rounded-xl border border-neutral-200 px-3.5 py-2 text-xs outline-none focus:border-brand"
              />
              <input
                type="text"
                value={inputUnit}
                onChange={(e) => setInputUnit(e.target.value)}
                placeholder="单位（如 克、根、个）"
                className="w-32 rounded-xl border border-neutral-200 px-3.5 py-2 text-xs outline-none focus:border-brand"
              />
            </div>
          </div>
          <button
            type="submit"
            className="w-full rounded-xl bg-brand py-2.5 text-xs font-semibold text-white shadow-sm"
          >
            确认加入清单
          </button>
        </form>
      )}

      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          {error}
        </p>
      )}

      {/* 待采清单 */}
      <section className="rounded-2xl bg-white p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between border-b border-neutral-100 pb-2">
          <h2 className="text-xs font-bold text-ink/80">
            待采购 / 待准备（{pendingItems.length}）
          </h2>
          {syncing && <span className="text-[10px] text-brand animate-pulse">正在保存…</span>}
        </div>

        {pendingItems.length === 0 ? (
          <p className="py-6 text-center text-xs text-ink/40">
            {totalCount === 0
              ? '清单空空如也，从菜谱详情或点单汇总一键导入吧'
              : '🎉 所有食材已全部备齐！'}
          </p>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {pendingItems.map((item) => (
              <li
                key={item.id}
                onClick={() => toggleItem(item.id)}
                className="flex cursor-pointer select-none items-center justify-between py-3 transition hover:bg-neutral-50/60"
              >
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={item.checked}
                    onChange={() => {}}
                    className="size-4 rounded accent-brand"
                    aria-label={`标记备齐 ${item.name}`}
                  />
                  <div>
                    <span className="font-semibold text-xs text-ink">{item.name}</span>
                    {item.sourceRecipeTitle && (
                      <span className="ml-1.5 rounded bg-brand-soft/60 px-1.5 py-0.5 text-[10px] text-brand-deep">
                        {item.sourceRecipeTitle}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-brand-deep">
                    {item.qty ? `${item.qty} ${item.unit}`.trim() : item.unit || '适量'}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      removeItem(item.id)
                    }}
                    className="text-neutral-300 hover:text-red-500 p-1 text-xs"
                    aria-label="删除食材"
                  >
                    ×
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 已备齐清单 */}
      {checkedItems.length > 0 && (
        <section className="rounded-2xl bg-white/70 p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-neutral-100 pb-2">
            <h2 className="text-xs font-bold text-ink/50">
              已备齐 / 已买到（{checkedItems.length}）
            </h2>
            <button
              type="button"
              onClick={handleClearChecked}
              className="text-xs text-red-500 hover:underline"
            >
              清除已备齐
            </button>
          </div>

          <ul className="divide-y divide-neutral-100 opacity-70">
            {checkedItems.map((item) => (
              <li
                key={item.id}
                onClick={() => toggleItem(item.id)}
                className="flex cursor-pointer select-none items-center justify-between py-2.5 transition line-through text-ink/40"
              >
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={item.checked}
                    onChange={() => {}}
                    className="size-4 rounded accent-brand"
                    aria-label={`取消备齐 ${item.name}`}
                  />
                  <span className="text-xs">{item.name}</span>
                </div>
                <span className="text-xs">
                  {item.qty ? `${item.qty} ${item.unit}`.trim() : item.unit || ''}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
