import { getAdminClient } from '@/lib/supabase'
import type { ImportJob, ImportJobItem, RecipeSourceType, JobErrorCode } from '@kaifan/shared'
import { generateSingleRecipe } from './recipe-generator'
import { saveRecipe } from './recipe-importer'
import { safeParseRecipe } from '@kaifan/shared'

export interface CreateJobOptions {
  type: RecipeSourceType
  payload: Record<string, unknown>
  items: Array<Record<string, unknown>>
  createdBy?: string
}

/**
 * 异步睡眠工具（支持 Jitter 指数退避）
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * 计算带 Jitter 随机抖动的指数退避延迟时间（JOB_SYSTEM.md §3）
 * attempt 1 -> ~2s, attempt 2 -> ~4s, attempt 3 -> ~8s
 */
function calculateBackoffDelay(attempt: number, baseMs: number = 2000, maxMs: number = 10000): number {
  const expDelay = Math.min(maxMs, baseMs * Math.pow(2, Math.max(0, attempt - 1)))
  const jitter = Math.random() * 1000 // 0~1000ms 随机扰动
  return Math.floor(expDelay + jitter)
}

/**
 * 创建并排队一个异步导入任务
 */
export async function createImportJob(options: CreateJobOptions): Promise<string> {
  const supabase = getAdminClient()

  // 1. 插入主任务
  const { data: jobData, error: jobError } = await supabase
    .from('import_jobs')
    .insert({
      type: options.type,
      status: 'pending',
      total: options.items.length,
      completed: 0,
      succeeded: 0,
      failed: 0,
      payload: options.payload,
      created_by: options.createdBy || null,
    })
    .select('id')
    .single()

  if (jobError || !jobData) {
    throw new Error(`创建任务失败: ${jobError?.message}`)
  }

  const jobId = jobData.id as string

  // 2. 批量插入子任务明细
  const itemRows = options.items.map((item) => ({
    job_id: jobId,
    input: item,
    status: 'pending',
    attempt: 0,
    max_attempts: 3,
  }))

  const { error: itemError } = await supabase.from('import_job_items').insert(itemRows)
  if (itemError) {
    console.error('插入任务明细失败:', itemError.message)
  }

  return jobId
}

/**
 * 执行/推进指定任务的子项处理（支持 CAS 状态原子抢占、Jitter 指数退避与部分成功判定）
 */
export async function processJobItems(jobId: string, batchSize: number = 3): Promise<void> {
  const supabase = getAdminClient()

  // 1. 原子激活主任务状态为 running
  await supabase
    .from('import_jobs')
    .update({ status: 'running', started_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', jobId)
    .in('status', ['pending', 'running'])

  // 2. 获取待处理或待重试的候选子项
  const { data: candidateItems, error: fetchErr } = await supabase
    .from('import_job_items')
    .select('*')
    .eq('job_id', jobId)
    .in('status', ['pending', 'failed'])
    .order('created_at', { ascending: true })
    .limit(batchSize)

  if (fetchErr || !candidateItems || candidateItems.length === 0) {
    await updateJobSummaryStatus(jobId)
    return
  }

  for (const item of candidateItems) {
    // 若已达最大重试次数则跳过
    if (item.status === 'failed' && item.attempt >= item.max_attempts) {
      continue
    }

    const currentAttempt = item.attempt + 1

    // 3. CAS 原子抢占：仅当状态仍处于 pending 或 failed 时原子抢占成功置为 running
    const { data: claimed, error: claimError } = await supabase
      .from('import_job_items')
      .update({
        status: 'running',
        attempt: currentAttempt,
        started_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', item.id)
      .in('status', ['pending', 'failed'])
      .select('id')
      .maybeSingle()

    // 抢占失败（已被其他并发 Worker 领取），跳过本项
    if (claimError || !claimed) {
      continue
    }

    // 4. 重试场景执行带 Jitter 的真实指数退避延迟（JOB_SYSTEM.md §3）
    if (currentAttempt > 1) {
      const backoffDelay = calculateBackoffDelay(currentAttempt)
      await sleep(backoffDelay)
    }

    try {
      // 业务处理分流
      const title = (item.input?.title as string) || '未命名菜谱'
      const generated = await generateSingleRecipe(title)

      const validation = safeParseRecipe(generated)
      if (!validation.success) {
        throw new Error('LLM 结构校验失败')
      }

      const saveRes = await saveRecipe(validation.data, { status: 'pending' })
      if (!saveRes.ok) {
        throw new Error(saveRes.message)
      }

      // 标记单项成功
      await supabase
        .from('import_job_items')
        .update({
          status: 'succeeded',
          result: { title: validation.data.title, recipeId: saveRes.recipeId },
          recipe_id: saveRes.recipeId || null,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', item.id)
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err)
      const isMaxAttempt = currentAttempt >= item.max_attempts
      const errorCode: JobErrorCode = errMsg.includes('超时') ? 'TIMEOUT' : 'PROVIDER_ERROR'

      await supabase
        .from('import_job_items')
        .update({
          status: isMaxAttempt ? 'failed' : 'pending',
          error_code: errorCode,
          error_message: errMsg,
          completed_at: isMaxAttempt ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', item.id)
    }
  }

  // 5. 刷新主任务进度与状态汇总
  await updateJobSummaryStatus(jobId)
}

/**
 * 汇总并更新主任务的状态与进度
 */
export async function updateJobSummaryStatus(jobId: string): Promise<void> {
  const supabase = getAdminClient()

  const { data: allItems } = await supabase
    .from('import_job_items')
    .select('status, attempt, max_attempts')
    .eq('job_id', jobId)

  if (!allItems || allItems.length === 0) return

  const total = allItems.length
  const succeeded = allItems.filter((i) => i.status === 'succeeded').length
  const failed = allItems.filter((i) => i.status === 'failed' && i.attempt >= i.max_attempts).length
  const completed = succeeded + failed
  const isAllDone = completed === total

  let finalStatus: ImportJob['status'] = 'running'
  if (isAllDone) {
    if (succeeded === total) {
      finalStatus = 'succeeded'
    } else if (succeeded > 0 && failed > 0) {
      finalStatus = 'partial_success'
    } else {
      finalStatus = 'failed'
    }
  }

  await supabase
    .from('import_jobs')
    .update({
      total,
      completed,
      succeeded,
      failed,
      status: finalStatus,
      completed_at: isAllDone ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', jobId)
}
