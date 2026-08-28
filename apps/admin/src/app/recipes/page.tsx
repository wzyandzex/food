import Link from 'next/link'
import { getAdminClient, isAdminSupabaseConfigured } from '@/lib/supabase'
import { Plus } from 'lucide-react'

interface RecipeItem {
  id: string
  title: string
  source_type: string
  difficulty: number
  minutes: number
  servings: number
  tags: string[]
  status: string
  created_at: string
}

async function fetchRecipes(): Promise<RecipeItem[]> {
  if (!isAdminSupabaseConfigured()) return []
  try {
    const supabase = getAdminClient()
    const { data } = await supabase
      .from('recipes')
      .select('id, title, source_type, difficulty, minutes, servings, tags, status, created_at')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(50)

    return (data as RecipeItem[]) || []
  } catch {
    return []
  }
}

export default async function RecipesManagementPage() {
  const recipes = await fetchRecipes()

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">菜谱资产库</h1>
          <p className="text-sm text-neutral-500 mt-1">
            统一检索、维护公共菜谱库与标准化元数据，支持版本演进与上下架控制
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/jobs"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-medium transition shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>新建导入</span>
          </Link>
        </div>
      </div>

      {/* 菜谱表格 */}
      <div className="bg-white rounded-xl border border-neutral-200/80 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-neutral-100 flex items-center justify-between gap-4">
          <div className="text-xs font-semibold text-neutral-700">共检索到 {recipes.length} 道菜谱</div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-neutral-50/70 border-b border-neutral-100 text-neutral-500 uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3 font-semibold">菜品名称</th>
                <th className="px-4 py-3 font-semibold">来源渠道</th>
                <th className="px-4 py-3 font-semibold">耗时 / 份量</th>
                <th className="px-4 py-3 font-semibold">标签</th>
                <th className="px-4 py-3 font-semibold">状态</th>
                <th className="px-4 py-3 font-semibold">创建时间</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {recipes.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-neutral-400">
                    暂无菜谱数据
                  </td>
                </tr>
              ) : (
                recipes.map((r) => (
                  <tr key={r.id} className="hover:bg-neutral-50/60 transition-colors">
                    <td className="px-5 py-3.5 font-medium text-neutral-900">{r.title}</td>
                    <td className="px-4 py-3.5">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-neutral-100 text-neutral-600">
                        {r.source_type}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-neutral-600">
                      {r.minutes} 分钟 / {r.servings} 人份
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex flex-wrap gap-1">
                        {r.tags?.slice(0, 3).map((t) => (
                          <span
                            key={t}
                            className="px-1.5 py-0.5 rounded text-[10px] bg-neutral-50 border border-neutral-200 text-neutral-600"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                          r.status === 'published'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : r.status === 'pending'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-neutral-100 text-neutral-600'
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-neutral-400">
                      {new Date(r.created_at).toLocaleDateString('zh-CN')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
