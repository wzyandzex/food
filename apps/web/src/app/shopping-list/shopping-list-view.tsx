'use client'

import { useState } from 'react'
import type { ShoppingListItem } from '@kaifan/shared'

interface ShoppingListViewProps {
  initialListId: string | null
  initialItems: ShoppingListItem[]
  getAccessToken: () => Promise<string | null>
}

export function ShoppingListView({
  initialListId,
  initialItems,
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

  const pendingItems = items.filter((item) => !item.checked)
  const checkedItems = items.filter((item) => item.checked)
  const totalCount = items.length
  const progress = totalCount > 0 ? Math.round((checkedItems.length / totalCount) * 100) : 0

  // 统一持久化更新
  const persistItems = async (updatedItems: ShoppingListItem[], targetListId = listId) => {
    setSyncing(true)
    setError('')
    try {
      const token = await getAccessToken()
      if (!token) return

      if (targetListId) {
        const res = await fetch(`/api/shopping-lists/${targetListId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ items: updatedItems }),
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
          body: JSON.stringify({ items: updatedItems, mode: 'replace' }),
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
      setSyncing(false)
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
      id: `manual_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name,
      qty,
      unit,
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

  // 4. 一键清除已备齐项
  const clearCheckedItems = () => {
    if (checkedItems.length === 0) return
    const updated = items.filter((item) => !item.checked)
    setItems(updated)
    void persistItems(updated)
  }

  // 5. 一键全部清空
  const clearAll = () => {
    if (!confirm('确定清空整个购物清单吗？')) return
    setItems([])
    void persistItems([])
  }

  // 6. 复制微信分享文本
  const copyShareText = () => {
    if (pendingItems.length === 0) return
    const textList = pendingItems.map((it, idx) => {
      const amount = it.qty ? ` ${it.qty}${it.unit || ''}` : ''
      return `${idx + 1}. ${it.name}${amount}`
    })
    const text = `🛒【买菜清单】\n${textList.join('\n')}\n\n（由「开饭」生成）`
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="space-y-4">
      {/* 进度与统计卡片 */}
      <section className="rounded-2xl bg-white p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between text-xs text-ink/60">
          <span className="font-semibold text-ink">
            {pendingItems.length === 0 && totalCount > 0
              ? '🎉 全部食材已备齐！'
              : `待备齐 ${pendingItems.length} 项 / 已备齐 ${checkedItems.length} 项`}
          </span>
          <div className="flex items-center gap-2">
            {syncing && <span className="text-xs text-brand">同步中…</span>}
            <span className="font-bold text-brand">{progress}%</span>
          </div>
        </div>

        {/* 进度条 */}
        <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-100">
          <div
            className="h-full bg-brand transition-all duration-300 rounded-full"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="flex items-center justify-between pt-1 text-xs">
          <button
            type="button"
            onClick={() => setIsAdding(!isAdding)}
            className="font-semibold text-brand active:scale-95"
          >
            {isAdding ? '收起添加' : '+ 加一项食材'}
          </button>
          <div className="flex items-center gap-3">
            {pendingItems.length > 0 && (
              <button
                type="button"
                onClick={copyShareText}
                className="text-ink/60 underline active:scale-95"
              >
                {copied ? '✓ 已复制文本' : '📋 复制微信文本'}
              </button>
            )}
            {totalCount > 0 && (
              <button
                type="button"
                onClick={clearAll}
                className="text-neutral-400 active:scale-95"
              >
                清空
              </button>
            )}
          </div>
        </div>
      </section>

      {/* 快捷添加表单 */}
      {isAdding && (
        <form
          onSubmit={handleAddItem}
          className="rounded-2xl bg-white p-4 shadow-sm space-y-3 border border-brand/20"
        >
          <div className="text-xs font-bold text-ink">添加食材 / 调料</div>
          <div className="flex gap-2">
            <input
              type="text"
              value={inputName}
              onChange={(e) => setInputName(e.target.value)}
              placeholder="食材名称（如：鸡蛋）"
              className="flex-2 rounded-lg border border-neutral-200 px-3 py-2 text-xs outline-none focus:border-brand"
              autoFocus
              required
            />
            <input
              type="number"
              step="any"
              value={inputQty}
              onChange={(e) => setInputQty(e.target.value)}
              placeholder="数量"
              className="flex-1 rounded-lg border border-neutral-200 px-2 py-2 text-xs outline-none focus:border-brand text-center"
            />
            <input
              type="text"
              value={inputUnit}
              onChange={(e) => setInputUnit(e.target.value)}
              placeholder="单位"
              className="flex-1 rounded-lg border border-neutral-200 px-2 py-2 text-xs outline-none focus:border-brand text-center"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="rounded-lg bg-neutral-100 px-3 py-1.5 text-xs text-ink/60"
            >
              取消
            </button>
            <button
              type="submit"
              className="rounded-lg bg-brand px-4 py-1.5 text-xs font-semibold text-white shadow-sm"
            >
              确定加入
            </button>
          </div>
        </form>
      )}

      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          {error}
        </p>
      )}

      {/* 空态 */}
      {totalCount === 0 && !isAdding && (
        <section className="rounded-2xl bg-white p-8 text-center shadow-sm space-y-3">
          <p className="text-4xl">🛒</p>
          <h2 className="text-sm font-semibold">购物清单是空的</h2>
          <p className="text-xs text-ink/50 leading-5">
            可以从「菜谱详情」或「点单汇总」一键存入，也可以点上方「+ 加一项食材」手动添加。
          </p>
          <button
            type="button"
            onClick={() => setIsAdding(true)}
            className="rounded-xl bg-brand px-5 py-2.5 text-xs font-semibold text-white shadow-sm inline-block"
          >
            手动添加第一项
          </button>
        </section>
      )}

      {/* 待备齐食材列表（Unchecked） */}
      {pendingItems.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xs font-bold text-ink/70 px-1">
            待采购 / 待准备（{pendingItems.length}）
          </h2>
          <div className="space-y-2">
            {pendingItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-2xl bg-white p-4 shadow-sm active:scale-[0.99] transition"
              >
                <div
                  className="flex items-center gap-3 flex-1 cursor-pointer select-none"
                  onClick={() => toggleItem(item.id)}
                >
                  <div className="size-5 rounded-md border-2 border-brand/50 flex items-center justify-center bg-white transition">
                    {item.checked ? <span className="text-brand font-bold text-xs">✓</span> : null}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-ink">{item.name}</p>
                    {item.sourceRecipeTitle && (
                      <p className="text-[10px] text-ink/40">来自：{item.sourceRecipeTitle}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-xs font-medium text-brand-deep">
                    {item.qty ? `${item.qty} ${item.unit || ''}` : item.unit || '适量'}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    className="text-xs text-neutral-300 hover:text-red-400 p-1"
                    title="删除"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 已备齐食材列表（Checked） */}
      {checkedItems.length > 0 && (
        <section className="space-y-2 pt-2">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xs font-bold text-ink/50">已备齐（{checkedItems.length}）</h2>
            <button
              type="button"
              onClick={clearCheckedItems}
              className="text-[11px] text-red-500 underline"
            >
              清除已备齐项
            </button>
          </div>
          <div className="space-y-2 opacity-65">
            {checkedItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-2xl bg-neutral-100/80 p-3.5 shadow-none transition"
              >
                <div
                  className="flex items-center gap-3 flex-1 cursor-pointer select-none"
                  onClick={() => toggleItem(item.id)}
                >
                  <div className="size-5 rounded-md border-2 border-neutral-400 bg-neutral-300 flex items-center justify-center text-white text-xs font-bold">
                    ✓
                  </div>
                  <p className="text-sm text-ink/60 line-through">{item.name}</p>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-xs text-ink/40 line-through">
                    {item.qty ? `${item.qty} ${item.unit || ''}` : item.unit || '适量'}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    className="text-xs text-neutral-400 hover:text-red-400 p-1"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
