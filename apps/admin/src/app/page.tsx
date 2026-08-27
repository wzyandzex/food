import Link from 'next/link'
import { getAdminClient } from '@/lib/supabase'

interface StatSummary {
  totalRecipes: number
  pendingRecipes: number
  totalIngredients: number
  totalCookSessions: number
}

async function fetchStats(): Promise<StatSummary> {
  try {
    const supabase = getAdminClient()
    const [publishedRes, pendingRes, ingredientsRes, cookRes] = await Promise.all([
      supabase.from('recipes').select('id', { count: 'exact', head: true }).eq('status', 'published').is('deleted_at', null),
      supabase.from('recipes').select('id', { count: 'exact', head: true }).eq('status', 'pending').is('deleted_at', null),
      supabase.from('ingredients').select('id', { count: 'exact', head: true }),
      supabase.from('cook_sessions').select('id', { count: 'exact', head: true }),
    ])

    return {
      totalRecipes: publishedRes.count ?? 0,
      pendingRecipes: pendingRes.count ?? 0,
      totalIngredients: ingredientsRes.count ?? 0,
      totalCookSessions: cookRes.count ?? 0,
    }
  } catch {
    return {
      totalRecipes: 0,
      pendingRecipes: 0,
      totalIngredients: 0,
      totalCookSessions: 0,
    }
  }
}

export default async function AdminHomePage() {
  const stats = await fetchStats()

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10">
      {/* 顶栏 */}
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-brand text-2xl text-white shadow-sm">
              🍚
            </span>
            <div>
              <h1 className="text-xl font-bold text-neutral-900">开饭 · 管理运营后台</h1>
              <p className="text-xs text-neutral-500">菜谱多源导入管线 · 内容审核 · 动态 LLM 设置</p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/import"
            className="rounded-xl bg-brand px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-brand-deep active:scale-95 transition"
          >
            📥 菜谱导入管线
          </Link>
          <Link
            href="/settings"
            className="rounded-xl border border-neutral-300 bg-white px-3.5 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 shadow-sm active:scale-95 transition"
          >
            ⚙️ 系统设置
          </Link>
          <Link
            href="/login"
            className="rounded-xl bg-neutral-900 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-neutral-800 active:scale-95 transition"
          >
            重新登录
          </Link>
        </div>
      </header>

      {/* 实时数据看板 */}
      <section className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium text-neutral-500">已上架菜谱</p>
          <p className="mt-2 text-2xl font-bold text-neutral-900">{stats.totalRecipes}</p>
          <p className="mt-1 text-[11px] text-neutral-400">公开库可用</p>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-amber-900">待审核暂存</p>
            {stats.pendingRecipes > 0 && (
              <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-bold text-amber-900">
                需处理
              </span>
            )}
          </div>
          <p className="mt-2 text-2xl font-bold text-amber-900">{stats.pendingRecipes}</p>
          <Link href="/import" className="mt-1 inline-block text-[11px] font-medium text-amber-800 underline">
            去审核上架 →
          </Link>
        </div>

        <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium text-neutral-500">食材词库规模</p>
          <p className="mt-2 text-2xl font-bold text-neutral-900">{stats.totalIngredients}</p>
          <p className="mt-1 text-[11px] text-neutral-400">支持清冰箱匹配</p>
        </div>

        <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium text-neutral-500">全站做饭日志</p>
          <p className="mt-2 text-2xl font-bold text-neutral-900">{stats.totalCookSessions}</p>
          <p className="mt-1 text-[11px] text-neutral-400">累计做饭顿次</p>
        </div>
      </section>

      {/* 快捷操作区 */}
      <h2 className="mb-4 text-xs font-bold text-neutral-500">核心功能管线（点击直达）</h2>
      <section className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          href="/import"
          className="group rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm hover:border-brand/50 hover:shadow-md transition"
        >
          <div className="mb-2 flex items-center justify-between">
            <span className="text-2xl">🔗</span>
            <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-800">
              已就绪
            </span>
          </div>
          <h3 className="font-bold text-sm text-neutral-900 group-hover:text-brand">URL 单篇抓取抽取</h3>
          <p className="mt-1 text-xs text-neutral-500 leading-5">
            输入下厨房、豆果或美食博客链接，AI 自动抓取正文并提取为标准菜谱。
          </p>
        </Link>

        <Link
          href="/import"
          className="group rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm hover:border-brand/50 hover:shadow-md transition"
        >
          <div className="mb-2 flex items-center justify-between">
            <span className="text-2xl">📷</span>
            <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-800">
              已就绪
            </span>
          </div>
          <h3 className="font-bold text-sm text-neutral-900 group-hover:text-brand">图片 OCR 拍照识别</h3>
          <p className="mt-1 text-xs text-neutral-500 leading-5">
            上传菜谱书本、手写备忘录或聊天截图，视觉多模态大模型转为结构化菜谱。
          </p>
        </Link>

        <Link
          href="/import"
          className="group rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm hover:border-brand/50 hover:shadow-md transition"
        >
          <div className="mb-2 flex items-center justify-between">
            <span className="text-2xl">🤖</span>
            <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-800">
              已就绪
            </span>
          </div>
          <h3 className="font-bold text-sm text-neutral-900 group-hover:text-brand">LLM 菜名批量调研生成</h3>
          <p className="mt-1 text-xs text-neutral-500 leading-5">
            输入菜名清单（逗号分隔），AI 批量自动生成带用量与步骤的完整菜谱。
          </p>
        </Link>

        <Link
          href="/import"
          className="group rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm hover:border-brand/50 hover:shadow-md transition"
        >
          <div className="mb-2 flex items-center justify-between">
            <span className="text-2xl">📑</span>
            <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-800">
              已就绪
            </span>
          </div>
          <h3 className="font-bold text-sm text-neutral-900 group-hover:text-brand">Excel / JSON 批量导入</h3>
          <p className="mt-1 text-xs text-neutral-500 leading-5">
            按照标准表头上传表格或粘贴 JSON 数据，先校验报告再一键暂存。
          </p>
        </Link>

        <Link
          href="/settings"
          className="group rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm hover:border-brand/50 hover:shadow-md transition"
        >
          <div className="mb-2 flex items-center justify-between">
            <span className="text-2xl">⚙️</span>
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-800">
              热重载
            </span>
          </div>
          <h3 className="font-bold text-sm text-neutral-900 group-hover:text-brand">AI 动态端点与模型设置</h3>
          <p className="mt-1 text-xs text-neutral-500 leading-5">
            实时修改 Base URL、API Key 与模型名（如 Gemini 3.7 Flash），一键连通性测试。
          </p>
        </Link>
      </section>

      <footer className="mt-12 text-center text-xs text-neutral-400">
        开饭 KaiFan · 管理运营端 · 独立于用户端安全部署
      </footer>
    </main>
  )
}
