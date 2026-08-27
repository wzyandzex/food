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
 * 执行/推进指定任务的子项处理（支持退避重试、部分成功判断）
 */
export async function processJobItems(jobId: string, batchSize: number = 3): Promise<void> {
  const supabase = getAdminClient()

  // 更新主任务为 running
  await supabase
    .from('import_jobs')
    .update({ status: 'running', started_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', jobId)
    .eq('status', 'pending')

  // 获取待处理或重试中的子项
  const { data: items, error: fetchErr } = await supabase
    .from('import_job_items')
    .select('*')
    .eq('job_id', jobId)
    .in('status', ['pending', 'failed'])
    .order('created_at', { ascending: true })
    .limit(batchSize)

  if (fetchErr || !items || items.length === 0) {
    await updateJobSummaryStatus(jobId)
    return
  }

  for (const item of items) {
    // 若已达最大重试次数则跳过
    if (item.status === 'failed' && item.attempt >= item.max_attempts) {
      continue
    }

    const currentAttempt = item.attempt + 1

    await supabase
      .from('import_job_items')
      .update({
        status: 'running',
        attempt: currentAttempt,
        started_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', item.id)

    try {
      // 业务处理分流
      const title = (item.input.title as string) || '未命名菜谱'
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
          result: { title: validation.data.title, recipeId: saveRes.id },
          recipe_id: saveRes.id || null,
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

  // 刷新主任务进度统计
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
