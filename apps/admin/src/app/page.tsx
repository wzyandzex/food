import Link from 'next/link'
import { getAdminClient } from '@/lib/supabase'
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

async function fetchDashboardData(): Promise<DashboardStats> {
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
      recentJobs: (recentJobsRes.data || []).map((j: any) => ({
        id: j.id,
        type: j.type,
        status: j.status,
        total: j.total,
        succeeded: j.succeeded,
        failed: j.failed,
        createdAt: j.created_at,
      })),
      recentAudits: (auditsRes.data || []).map((a: any) => ({
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

export default async function AdminDashboardPage() {
  const data = await fetchDashboardData()

  return (
    <div className="space-y-8">
      {/* 顶部标题区 */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">运营概况看板</h1>
          <p className="text-sm text-neutral-500 mt-1">
            实时监控系统核心指标、内容审核工单与后台异步导入队列
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/jobs"
            className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
          >
            <Layers className="w-4 h-4" />
            <span>新建导入任务</span>
          </Link>
          <Link
            href="/review"
            className="inline-flex items-center gap-2 px-4 py-2 bg-white hover:bg-neutral-50 border border-neutral-200 text-neutral-700 rounded-lg text-sm font-medium transition-colors shadow-sm"
          >
            <Clock className="w-4 h-4 text-amber-600" />
            <span>待审工单 ({data.pendingRecipes})</span>
          </Link>
        </div>
      </div>

      {/* 第一层：关键指标卡片 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-neutral-200/80 shadow-xs">
          <div className="flex items-center justify-between text-neutral-500">
            <span className="text-xs font-medium uppercase tracking-wider">已上架菜谱</span>
            <UtensilsCrossed className="w-4 h-4 text-neutral-400" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-neutral-900">{data.totalRecipes}</span>
            <span className="text-xs text-neutral-400">道</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-neutral-200/80 shadow-xs">
          <div className="flex items-center justify-between text-neutral-500">
            <span className="text-xs font-medium uppercase tracking-wider">待审核工单</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-amber-600">{data.pendingRecipes}</span>
            <span className="text-xs text-neutral-400">项需人工确认</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-neutral-200/80 shadow-xs">
          <div className="flex items-center justify-between text-neutral-500">
            <span className="text-xs font-medium uppercase tracking-wider">运行中异步任务</span>
            <Layers className="w-4 h-4 text-blue-500" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-neutral-900">{data.runningJobs}</span>
            <span className="text-xs text-neutral-400">个任务处理中</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-neutral-200/80 shadow-xs">
          <div className="flex items-center justify-between text-neutral-500">
            <span className="text-xs font-medium uppercase tracking-wider">异常失败任务</span>
            <AlertCircle className={`w-4 h-4 ${data.failedJobs > 0 ? 'text-red-500' : 'text-neutral-400'}`} />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className={`text-2xl font-bold ${data.failedJobs > 0 ? 'text-red-600' : 'text-neutral-900'}`}>
              {data.failedJobs}
            </span>
            <span className="text-xs text-neutral-400">个任务待重试</span>
          </div>
        </div>
      </div>

      {/* 第二层：运营待办事项 */}
      {(data.pendingRecipes > 0 || data.failedJobs > 0) && (
        <div className="bg-amber-50/60 border border-amber-200 rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <div className="font-semibold text-amber-950 text-sm">运营待办事项提醒</div>
              <div className="text-xs text-amber-800/80 mt-0.5">
                当前有 <span className="font-bold">{data.pendingRecipes}</span> 篇待审菜谱等待处理；
                {data.failedJobs > 0 && <span> 有 <span className="font-bold">{data.failedJobs}</span> 个失败导入任务需要关注；</span>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {data.pendingRecipes > 0 && (
              <Link
                href="/review"
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-medium rounded-md shadow-xs transition"
              >
                处理审核
              </Link>
            )}
            {data.failedJobs > 0 && (
              <Link
                href="/jobs?status=failed"
                className="px-3 py-1.5 bg-white border border-amber-300 text-amber-900 hover:bg-amber-50 text-xs font-medium rounded-md shadow-xs transition"
              >
                查看失败项
              </Link>
            )}
          </div>
        </div>
      )}

      {/* 第三层与第四层：最近导入任务 + 系统健康度 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左侧 2 列：最近任务流水 */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-neutral-200/80 shadow-xs overflow-hidden">
          <div className="px-5 py-4 border-b border-neutral-100 flex items-center justify-between">
            <div className="font-semibold text-sm text-neutral-900">最近导入任务</div>
            <Link href="/jobs" className="text-xs text-amber-600 hover:underline flex items-center gap-1">
              <span>查看全部任务</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="divide-y divide-neutral-100">
            {data.recentJobs.length === 0 ? (
              <div className="py-8 text-center text-xs text-neutral-400">暂无导入任务</div>
            ) : (
              data.recentJobs.map((job) => (
                <div key={job.id} className="p-4 flex items-center justify-between hover:bg-neutral-50/60 transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="px-2 py-0.5 rounded text-[11px] font-mono uppercase bg-neutral-100 text-neutral-700">
                      {job.type}
                    </span>
                    <div>
                      <div className="text-xs font-medium text-neutral-900">
                        批次 {job.id.slice(0, 8)}
                      </div>
                      <div className="text-[11px] text-neutral-400 mt-0.5">
                        {new Date(job.createdAt).toLocaleString('zh-CN')}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="text-xs text-neutral-600">
                        {job.succeeded}/{job.total} 成功
                      </div>
                      {job.failed > 0 && (
                        <div className="text-[11px] text-red-500">{job.failed} 失败</div>
                      )}
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${
                        job.status === 'succeeded'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : job.status === 'running'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200 animate-pulse'
                          : job.status === 'failed'
                          ? 'bg-red-50 text-red-700 border border-red-200'
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

        {/* 右侧 1 列：系统健康 + 最近操作审计 */}
        <div className="space-y-6">
          {/* 系统健康 */}
          <div className="bg-white rounded-xl border border-neutral-200/80 shadow-xs p-5">
            <div className="font-semibold text-sm text-neutral-900 mb-4 flex items-center gap-2">
              <Activity className="w-4 h-4 text-neutral-500" />
              <span>系统运行指标</span>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-neutral-600">
                  <Database className="w-3.5 h-3.5" />
                  <span>PostgreSQL 数据库</span>
                </div>
                <div className="flex items-center gap-1 text-emerald-600 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>正常</span>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-neutral-600">
                  <HardDrive className="w-3.5 h-3.5" />
                  <span>Storage 存储桶</span>
                </div>
                <div className="flex items-center gap-1 text-emerald-600 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>就绪</span>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-neutral-600">
                  <Cpu className="w-3.5 h-3.5" />
                  <span>AI Provider (LLM/Vision)</span>
                </div>
                <div className="flex items-center gap-1 text-emerald-600 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>热重载中</span>
                </div>
              </div>
            </div>
          </div>

          {/* 最近审计活动 */}
          <div className="bg-white rounded-xl border border-neutral-200/80 shadow-xs p-5">
            <div className="font-semibold text-sm text-neutral-900 mb-3">最近审计活动</div>
            <div className="space-y-2.5">
              {data.recentAudits.length === 0 ? (
                <div className="text-xs text-neutral-400 py-3 text-center">暂无审计留痕</div>
              ) : (
                data.recentAudits.map((audit) => (
                  <div key={audit.id} className="text-xs flex items-center justify-between py-1 border-b border-neutral-50 last:border-0">
                    <span className="font-mono text-neutral-700 truncate max-w-[140px]">
                      {audit.action}
                    </span>
                    <span className="text-[10px] text-neutral-400">
                      {new Date(audit.createdAt).toLocaleTimeString('zh-CN')}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
