import { NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase'
import { createImportJob, processJobItems } from '@/lib/job-runner'
import { logAdminAction } from '@/lib/audit-logger'

/**
 * 导入任务列表与详情查询
 * GET /api/jobs?id=xxx (单任务及明细) 或 GET /api/jobs (任务列表)
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const jobId = searchParams.get('id')
  const status = searchParams.get('status')
  const limit = parseInt(searchParams.get('limit') || '20', 10)

  const supabase = getAdminClient()

  if (jobId) {
    const { data: job, error: jobErr } = await supabase
      .from('import_jobs')
      .select('*')
      .eq('id', jobId)
      .single()

    if (jobErr || !job) {
      return NextResponse.json({ error: '任务不存在' }, { status: 404 })
    }

    const { data: items } = await supabase
      .from('import_job_items')
      .select('*')
      .eq('job_id', jobId)
      .order('created_at', { ascending: true })

    return NextResponse.json({ job, items: items || [] })
  }

  let query = supabase.from('import_jobs').select('*').order('created_at', { ascending: false }).limit(limit)

  if (status && status !== 'all') {
    query = query.eq('status', status)
  }

  const { data: jobs, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ jobs: jobs || [] })
}

/**
 * 任务控制操作：
 * - action='create': 提交新异步任务
 * - action='process': 触发执行/推进一个批次（可由 Worker / 前端轮询触发）
 * - action='retry_failed': 仅重置并重试失败的子项
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    action?: string
    jobId?: string
    type?: string
    payload?: Record<string, unknown>
    items?: Array<Record<string, unknown>>
  } | null

  const action = body?.action || 'create'

  if (action === 'create') {
    if (!body?.type || !Array.isArray(body?.items) || body.items.length === 0) {
      return NextResponse.json({ error: '缺少必填字段（type, items）' }, { status: 400 })
    }

    const jobId = await createImportJob({
      type: body.type as any,
      payload: body.payload || {},
      items: body.items,
    })

    await logAdminAction({
      action: 'job.create',
      resourceType: 'import_job',
      resourceId: jobId,
      metadata: { type: body.type, count: body.items.length },
    })

    // 尝试异步就绪推进首批任务
    void processJobItems(jobId, 2).catch((err) => console.warn('首次推进任务失败:', err))

    return NextResponse.json({ ok: true, jobId, message: '导入任务已创建并在后台排队' })
  }

  if (action === 'process') {
    if (!body?.jobId) {
      return NextResponse.json({ error: '缺少 jobId' }, { status: 400 })
    }
    await processJobItems(body.jobId, 3)
    return NextResponse.json({ ok: true, message: '批次处理完成' })
  }

  if (action === 'retry_failed') {
    if (!body?.jobId) {
      return NextResponse.json({ error: '缺少 jobId' }, { status: 400 })
    }
    const supabase = getAdminClient()
    // 将所有失败子项重置为 pending
    await supabase
      .from('import_job_items')
      .update({
        status: 'pending',
        attempt: 0,
        error_code: null,
        error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq('job_id', body.jobId)
      .eq('status', 'failed')

    await supabase
      .from('import_jobs')
      .update({ status: 'running', updated_at: new Date().toISOString() })
      .eq('id', body.jobId)

    void processJobItems(body.jobId, 3).catch(console.error)

    await logAdminAction({
      action: 'job.retry_failed',
      resourceType: 'import_job',
      resourceId: body.jobId,
    })

    return NextResponse.json({ ok: true, message: '已重置失败子项并排队重试' })
  }

  return NextResponse.json({ error: '未知 action' }, { status: 400 })
}
