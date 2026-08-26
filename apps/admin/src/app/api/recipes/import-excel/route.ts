import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { safeParseRecipe, formatRecipeIssues, type RecipeV1 } from '@kaifan/shared'

import { saveRecipe } from '@/lib/recipe-importer'

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024 // 5MB
const MAX_ROWS = 200

interface ParsedExcelRow {
  recipe: RecipeV1 | null
  parseError?: string
}

/** Excel 表头约定（中文，与模板一致）：
 * 菜名 | 份量 | 难度(1-5) | 分钟 | 标签(逗号分隔) | 食材(分号分隔) | 步骤(分号分隔)
 * 食材行内用「名称:数量:单位」；可选食材用「名称:数量:单位:可选」 */
function parseExcel(buffer: ArrayBuffer): ParsedExcelRow[] {
  const workbook = XLSX.read(buffer, { type: 'array' })
  const firstSheetName = workbook.SheetNames[0]
  if (!firstSheetName) return []

  const sheet = workbook.Sheets[firstSheetName]
  if (!sheet) return []

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })
  if (rows.length > MAX_ROWS) {
    throw new Error(`单次上传行数超限（最多 ${MAX_ROWS} 行，当前 ${rows.length} 行）`)
  }

  return rows.map((row, index): ParsedExcelRow => {
    const title = String(row['菜名'] ?? '').trim()
    if (!title) {
      return { recipe: null, parseError: `第 ${index + 2} 行缺少菜名` }
    }

    const servings = Number(row['份量'] ?? 2) || 2
    const difficulty = Math.min(5, Math.max(1, Number(row['难度(1-5)'] ?? 2) || 2))
    const minutes = Number(row['分钟'] ?? 30) || 30

    const tags = String(row['标签(逗号分隔)'] ?? '')
      .split(/[,，]/)
      .map((tag) => tag.trim())
      .filter(Boolean)

    const ingredients = String(row['食材(分号分隔)'] ?? '')
      .split(/[;；]/)
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const [name, qtyStr, unit, optionalFlag] = part.split(/[:：]/)
        const parsedQty = qtyStr ? Number(qtyStr.trim()) : undefined
        return {
          name: (name ?? '').trim(),
          qty: typeof parsedQty === 'number' && !Number.isNaN(parsedQty) ? parsedQty : undefined,
          unit: (unit ?? '').trim() || undefined,
          optional: (optionalFlag ?? '').trim() === '可选',
        }
      })
      .filter((item) => item.name)

    const steps = String(row['步骤(分号分隔)'] ?? '')
      .split(/[;；]/)
      .map((part) => part.trim())
      .filter(Boolean)
      .map((text) => ({ text }))

    return {
      recipe: {
        schemaVersion: 'recipe.v1',
        title,
        servings,
        difficulty,
        minutes,
        tags,
        ingredients,
        steps,
        sourceType: 'xlsx',
      },
    }
  })
}

export async function POST(request: Request) {
  const formData = await request.formData()
  const file = formData.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, message: '请上传 .xlsx / .xls 文件' }, { status: 400 })
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json(
      { ok: false, message: `文件过大（上限 ${MAX_FILE_SIZE_BYTES / 1024 / 1024}MB）` },
      { status: 400 },
    )
  }

  let parsedRows: ParsedExcelRow[]
  try {
    const buffer = await file.arrayBuffer()
    parsedRows = parseExcel(buffer)
  } catch (error) {
    return NextResponse.json({ ok: false, message: `Excel 解析失败：${(error as Error).message}` }, { status: 400 })
  }

  if (parsedRows.length === 0) {
    return NextResponse.json({ ok: false, message: '未在表格中找到任何菜谱（请检查表头）' }, { status: 400 })
  }

  const results: { title: string; ok: boolean; message: string; recipeId?: string }[] = []
  let stagedCount = 0

  for (const item of parsedRows) {
    if (!item.recipe) {
      results.push({ title: '(未命名)', ok: false, message: item.parseError ?? '行解析失败' })
      continue
    }

    const parsed = safeParseRecipe(item.recipe)
    if (!parsed.success) {
      results.push({
        title: item.recipe.title,
        ok: false,
        message: formatRecipeIssues(parsed.error).join('；'),
      })
      continue
    }

    const recipe: RecipeV1 = parsed.data
    const result = await saveRecipe(recipe, { status: 'pending' })
    if (result.ok) stagedCount += 1
    results.push({
      title: recipe.title,
      ok: result.ok,
      message: result.message,
      recipeId: result.recipeId,
    })
  }

  return NextResponse.json({ ok: stagedCount > 0, stagedCount, results })
}
