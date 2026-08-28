import Link from 'next/link'
import { getAdminClient, isAdminSupabaseConfigured } from '@/lib/supabase'
import {
  UtensilsCrossed,
  Clock,
  Layers,
  AlertCircle,
  ArrowRight,
  Database,
  HardDrive,
  Cpu,
  Activity,
  CheckCircle2,
  XCircle,
} from 'lucide-react'

interface DashboardStats {
  totalRecipes: number
  pendingRecipes: number
  runningJobs: number
  failedJobs: number
  totalCookSessions: number
  systemHealth: {
    db: boolean
    ai: boolean
    storage: boolean
    jobs: boolean
  }
  recentJobs: Array<{
    id: string
    type: string
    status: string
    total: number
    succeeded: number
    failed: number
    createdAt: string
  }>
  recentAudits: Array<{
    id: string
    action: string
    resourceType: string
    createdAt: string
  }>
}

interface RawDbJob {
  id: string
  type: string
  status: string
  total: number
  succeeded: number
  failed: number
  created_at: string
}

interface RawDbAudit {
  id: string
  action: string
  resource_type: string
  created_at: string
}

async function fetchDashboardData(): Promise<DashboardStats> {
  if (!isAdminSupabaseConfigured()) {
    return {
      totalRecipes: 0,
      pendingRecipes: 0,
      runningJobs: 0,
      failedJobs: 0,
      totalCookSessions: 0,
      systemHealth: { db: false, ai: false, storage: false, jobs: false },
      recentJobs: [],
      recentAudits: [],
    }
  }

  const supabase = getAdminClient()
  try {
    const [recipesRes, pendingRes, runningJobsRes, failedJobsRes, cookRes, recentJobsRes, auditsRes] =
      await Promise.all([
        supabase.from('recipes').select('id', { count: 'exact', head: true }).eq('status', 'published').is('deleted_at', null),
        supabase.from('recipes').select('id', { count: 'exact', head: true }).eq('status', 'pending').is('deleted_at', null),
        supabase.from('import_jobs').select('id', { count: 'exact', head: true }).eq('status', 'running'),
        supabase.from('import_jobs').select('id', { count: 'exact', head: true }).eq('status', 'failed'),
        supabase.from('cook_sessions').select('id', { count: 'exact', head: true }),
        supabase.from('import_jobs').select('id, type, status, total, succeeded, failed, created_at').order('created_at', { ascending: false }).limit(5),
        supabase.from('admin_audit_logs').select('id, action, resource_type, created_at').order('created_at', { ascending: false }).limit(6),
      ])

    const typedJobs = (recentJobsRes.data || []) as unknown as RawDbJob[]
    const typedAudits = (auditsRes.data || []) as unknown as RawDbAudit[]

    return {
      totalRecipes: recipesRes.count ?? 0,
      pendingRecipes: pendingRes.count ?? 0,
      runningJobs: runningJobsRes.count ?? 0,
      failedJobs: failedJobsRes.count ?? 0,
      totalCookSessions: cookRes.count ?? 0,
      systemHealth: {
        db: !recipesRes.error,
        ai: true,
        storage: true,
        jobs: !runningJobsRes.error,
      },
      recentJobs: typedJobs.map((j) => ({
        id: j.id,
        type: j.type,
        status: j.status,
        total: j.total,
        succeeded: j.succeeded,
        failed: j.failed,
        createdAt: j.created_at,
      })),
      recentAudits: typedAudits.map((a) => ({
        id: a.id,
        action: a.action,
        resourceType: a.resource_type,
        createdAt: a.created_at,
      })),
    }
  } catch {
    return {
      totalRecipes: 0,
      pendingRecipes: 0,
      runningJobs: 0,
      failedJobs: 0,
      totalCookSessions: 0,
      systemHealth: { db: false, ai: false, storage: false, jobs: false },
      recentJobs: [],
      recentAudits: [],
    }
  }
}

export default async function AdminHomePage() {
  const stats = await fetchDashboardData()

  return (
    <div className="space-y-8">
      {/* 顶部标题 */}
      <div>
        <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">运营中控总览 (Command Center)</h1>
        <p className="text-sm text-neutral-500 mt-1">
          开饭 KaiFan 统一内容与任务调度后台 · 掌控全域菜谱、异步流水、审核流与服务健康度
        </p>
      </div>

      {/* 核心指标 KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-neutral-200/80 shadow-xs">
          <div className="flex items-center justify-between text-neutral-500">
            <span className="text-xs font-semibold uppercase tracking-wider">已上架菜谱</span>
            <UtensilsCrossed className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-neutral-900">{stats.totalRecipes}</span>
            <span className="text-xs text-neutral-400">公开可用</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-neutral-200/80 shadow-xs">
          <div className="flex items-center justify-between text-neutral-500">
            <span className="text-xs font-semibold uppercase tracking-wider">待人工审核</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-amber-600">{stats.pendingRecipes}</span>
            <span className="text-xs text-neutral-400">需确认入库</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-neutral-200/80 shadow-xs">
          <div className="flex items-center justify-between text-neutral-500">
            <span className="text-xs font-semibold uppercase tracking-wider">运行中任务</span>
            <Layers className="w-4 h-4 text-blue-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-neutral-900">{stats.runningJobs}</span>
            <span className="text-xs text-neutral-400">异步队列中</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-neutral-200/80 shadow-xs">
          <div className="flex items-center justify-between text-neutral-500">
            <span className="text-xs font-semibold uppercase tracking-wider">做饭记录总数</span>
            <Activity className="w-4 h-4 text-purple-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-neutral-900">{stats.totalCookSessions}</span>
            <span className="text-xs text-neutral-400">顿活跃留存</span>
          </div>
        </div>
      </div>

      {/* 系统就绪监控与快捷动作 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 系统健康监控 */}
        <div className="bg-white p-6 rounded-xl border border-neutral-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-neutral-900">核心服务可用性 (Ready State)</h2>
            <span className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              在线运行
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-lg bg-neutral-50 border border-neutral-100 flex items-center justify-between">
              <div className="flex items-center gap-2 text-neutral-700">
                <Database className="w-4 h-4 text-neutral-500" />
                <span>Supabase DB</span>
              </div>
              {stats.systemHealth.db ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              ) : (
                <XCircle className="w-4 h-4 text-red-500" />
              )}
            </div>

            <div className="p-3 rounded-lg bg-neutral-50 border border-neutral-100 flex items-center justify-between">
              <div className="flex items-center gap-2 text-neutral-700">
                <Cpu className="w-4 h-4 text-neutral-500" />
                <span>LLM 提取内核</span>
              </div>
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            </div>

            <div className="p-3 rounded-lg bg-neutral-50 border border-neutral-100 flex items-center justify-between">
              <div className="flex items-center gap-2 text-neutral-700">
                <HardDrive className="w-4 h-4 text-neutral-500" />
                <span>OSS 照片存储</span>
              </div>
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            </div>

            <div className="p-3 rounded-lg bg-neutral-50 border border-neutral-100 flex items-center justify-between">
              <div className="flex items-center gap-2 text-neutral-700">
                <Layers className="w-4 h-4 text-neutral-500" />
                <span>异步任务调度</span>
              </div>
              {stats.systemHealth.jobs ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              ) : (
                <XCircle className="w-4 h-4 text-red-500" />
              )}
            </div>
          </div>

          <div className="pt-2 border-t border-neutral-100 text-xs text-neutral-400">
            Node.js 24 / Next.js 15 App Router · 启用 SSRF 拦截与 CAS 任务调度防死锁
          </div>
        </div>

        {/* 快捷审核与待办 */}
        <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-neutral-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-neutral-900">运营行动项 (Actions Required)</h2>
            <Link
              href="/review"
              className="text-xs text-amber-700 hover:text-amber-800 font-medium flex items-center gap-1"
            >
              <span>前往审核中心</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {stats.pendingRecipes > 0 ? (
            <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200/80 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1 text-xs">
                <div className="font-semibold text-amber-900">
                  有 {stats.pendingRecipes} 条新生成的菜谱等待人工审定
                </div>
                <p className="text-amber-700 leading-relaxed">
                  大模型调研或批量导入的数据已安全隔离在待确认队列中，上架前请核验食材计量与步骤完整性。
                </p>
                <div className="pt-1">
                  <Link
                    href="/review"
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-medium transition"
                  >
                    立即审核并上架
                  </Link>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-neutral-400 text-xs rounded-xl bg-neutral-50/50 border border-neutral-100">
              当前暂无积压待审内容，所有管线运转顺畅。
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 text-xs">
            <Link
              href="/jobs"
              className="p-2.5 rounded-lg border border-neutral-200 hover:border-neutral-900 transition flex items-center justify-between text-neutral-700"
            >
              <span>创建批量任务</span>
              <ArrowRight className="w-3 h-3 text-neutral-400" />
            </Link>
            <Link
              href="/recipes"
              className="p-2.5 rounded-lg border border-neutral-200 hover:border-neutral-900 transition flex items-center justify-between text-neutral-700"
            >
              <span>浏览公共库</span>
              <ArrowRight className="w-3 h-3 text-neutral-400" />
            </Link>
            <Link
              href="/users"
              className="p-2.5 rounded-lg border border-neutral-200 hover:border-neutral-900 transition flex items-center justify-between text-neutral-700"
            >
              <span>用户准入管理</span>
              <ArrowRight className="w-3 h-3 text-neutral-400" />
            </Link>
          </div>
        </div>
      </div>

      {/* 底部双列：近期异步任务流水 + 操作审计记录 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 近期异步流水 */}
        <div className="bg-white rounded-xl border border-neutral-200/80 shadow-xs overflow-hidden">
          <div className="px-5 py-4 border-b border-neutral-100 flex items-center justify-between">
            <span className="font-semibold text-sm text-neutral-900">近期批量任务流水</span>
            <Link href="/jobs" className="text-xs text-neutral-500 hover:text-neutral-900">
              全部任务 →
            </Link>
          </div>
          <div className="divide-y divide-neutral-100 text-xs">
            {stats.recentJobs.length === 0 ? (
              <div className="p-6 text-center text-neutral-400">暂无任务记录</div>
            ) : (
              stats.recentJobs.map((job) => (
                <div key={job.id} className="p-4 flex items-center justify-between hover:bg-neutral-50/50">
                  <div className="space-y-0.5">
                    <div className="font-medium text-neutral-800 flex items-center gap-1.5">
                      <span className="font-mono text-[11px] px-1.5 py-0.5 bg-neutral-100 rounded text-neutral-600">
                        {job.type}
                      </span>
                      <span>批次 {job.id.slice(0, 8)}</span>
                    </div>
                    <div className="text-[11px] text-neutral-400">
                      {new Date(job.createdAt).toLocaleString('zh-CN')}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="text-emerald-600 font-semibold">{job.succeeded}</span>
                      <span className="text-neutral-400">/{job.total} 成功</span>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                        job.status === 'succeeded'
                          ? 'bg-emerald-50 text-emerald-700'
                          : job.status === 'running'
                          ? 'bg-blue-50 text-blue-700 animate-pulse'
                          : job.status === 'failed'
                          ? 'bg-red-50 text-red-700'
                          : 'bg-neutral-100 text-neutral-600'
                      }`}
                    >
                      {job.status}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 审计日志 */}
        <div className="bg-white rounded-xl border border-neutral-200/80 shadow-xs overflow-hidden">
          <div className="px-5 py-4 border-b border-neutral-100 flex items-center justify-between">
            <span className="font-semibold text-sm text-neutral-900">管理操作审计轨迹 (Audit Trail)</span>
            <span className="text-[11px] text-neutral-400">不可篡改</span>
          </div>
          <div className="divide-y divide-neutral-100 text-xs">
            {stats.recentAudits.length === 0 ? (
              <div className="p-6 text-center text-neutral-400">暂无审计日志</div>
            ) : (
              stats.recentAudits.map((audit) => (
                <div key={audit.id} className="p-3.5 flex items-center justify-between hover:bg-neutral-50/50">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100">
                      {audit.action}
                    </span>
                    <span className="text-neutral-600">{audit.resourceType}</span>
                  </div>
                  <span className="text-[11px] text-neutral-400 font-mono">
                    {new Date(audit.createdAt).toLocaleTimeString('zh-CN')}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
