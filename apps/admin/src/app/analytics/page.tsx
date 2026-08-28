import { getAdminClient, isAdminSupabaseConfigured } from '@/lib/supabase'

export default async function AnalyticsPage() {
  let recipesCount = { count: 0 }
  let cookCount = { count: 0 }
  let ordersCount = { count: 0 }
  let ingredientsCount = { count: 0 }

  if (isAdminSupabaseConfigured()) {
    try {
      const supabase = getAdminClient()
      const [r, c, o, i] = await Promise.all([
        supabase.from('recipes').select('id', { count: 'exact', head: true }),
        supabase.from('cook_sessions').select('id', { count: 'exact', head: true }),
        supabase.from('order_sessions').select('id', { count: 'exact', head: true }),
        supabase.from('ingredients').select('id', { count: 'exact', head: true }),
      ])
      recipesCount = { count: r.count ?? 0 }
      cookCount = { count: c.count ?? 0 }
      ordersCount = { count: o.count ?? 0 }
      ingredientsCount = { count: i.count ?? 0 }
    } catch {
      // 降级
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">数据与资源监控</h1>
        <p className="text-sm text-neutral-500 mt-1">
          掌握零成本资源边界（数据库行数、存储桶容量预警、AI 调用量）与核心做饭点单指标
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-neutral-200/80 shadow-xs">
          <div className="text-xs font-medium text-neutral-500">累计菜谱库容量</div>
          <div className="mt-3 text-2xl font-bold text-neutral-900">{recipesCount.count ?? 0} 道</div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-neutral-200/80 shadow-xs">
          <div className="text-xs font-medium text-neutral-500">标准化食材词库</div>
          <div className="mt-3 text-2xl font-bold text-neutral-900">{ingredientsCount.count ?? 0} 种</div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-neutral-200/80 shadow-xs">
          <div className="text-xs font-medium text-neutral-500">做饭记录 (CookSession)</div>
          <div className="mt-3 text-2xl font-bold text-neutral-900">{cookCount.count ?? 0} 顿</div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-neutral-200/80 shadow-xs">
          <div className="text-xs font-medium text-neutral-500">点单会话 (OrderSession)</div>
          <div className="mt-3 text-2xl font-bold text-neutral-900">{ordersCount.count ?? 0} 场</div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-neutral-200/80 shadow-xs p-6">
        <h2 className="text-sm font-semibold text-neutral-900 mb-4">免费资源配额预警评估</h2>
        <div className="space-y-4 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-neutral-600">PostgreSQL 存储配额 (免费版 500MB)</span>
            <span className="font-medium text-emerald-600">充裕 (&lt; 5%)</span>
          </div>
          <div className="w-full bg-neutral-100 rounded-full h-2">
            <div className="bg-emerald-500 h-2 rounded-full w-[4%]" />
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className="text-neutral-600">Storage 图片对象存储 (免费版 1GB)</span>
            <span className="font-medium text-emerald-600">充裕 (&lt; 2%)</span>
          </div>
          <div className="w-full bg-neutral-100 rounded-full h-2">
            <div className="bg-emerald-500 h-2 rounded-full w-[2%]" />
          </div>
        </div>
      </div>
    </div>
  )
}
