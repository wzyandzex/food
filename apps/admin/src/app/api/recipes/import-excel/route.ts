import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { safeParseRecipe, formatRecipeIssues, type RecipeV1 } from '@kaifan/shared'

import { importRecipe } from '@/lib/recipe-importer'

/** Excel 表头约定（中文，与模板一致）：
 * 菜名 | 份量 | 难度(1-5) | 分钟 | 标签(逗号分隔) | 食材(分号分隔) | 步骤(分号分隔)
 * 食材行内用「名称:数量:单位」；可选食材用「名称:数量:单位:可选」 */
function parseExcel(buffer: ArrayBuffer): RecipeV1[] {
  const workbook = XLSX.read(buffer, { type: 'array' })
  const firstSheetName = workbook.SheetNames[0]
  if (!firstSheetName) return []

  const sheet = workbook.Sheets[firstSheetName]
  if (!sheet) return []

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })
  return rows
    .map((row): RecipeV1 | null => {
      const title = String(row['菜名'] ?? '').trim()
      if (!title) return null

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
          return {
            name: (name ?? '').trim(),
            qty: Number(qtyStr) || undefined,
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
        schemaVersion: 'recipe.v1' as const,
        title,
        servings,
        difficulty,
        minutes,
        tags,
        ingredients,
        steps,
        sourceType: 'xlsx' as const,
      }
    })
    .filter((recipe): recipe is RecipeV1 => recipe !== null)
}

export async function POST(request: Request) {
  const formData = await request.formData()
  const file = formData.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, message: '请上传 .xlsx / .xls 文件' }, { status: 400 })
  }

  let recipes: RecipeV1[]
  try {
    const buffer = await file.arrayBuffer()
    recipes = parseExcel(buffer)
  } catch (error) {
    return NextResponse.json({ ok: false, message: `Excel 解析失败：${(error as Error).message}` }, { status: 400 })
  }

  if (recipes.length === 0) {
    return NextResponse.json({ ok: false, message: '未在表格中找到任何菜谱（请检查表头）' }, { status: 400 })
  }

  const results: { title: string; ok: boolean; message: string }[] = []
  let importedCount = 0

  for (const recipe of recipes) {
    const parsed = safeParseRecipe(recipe)
    if (!parsed.success) {
      results.push({
        title: recipe.title,
        ok: false,
        message: formatRecipeIssues(parsed.error).join('；'),
      })
      continue
    }
    const result = await importRecipe(recipe)
    if (result.ok) importedCount += result.importedCount ?? 0
    results.push({ title: recipe.title, ok: result.ok, message: result.message })
  }

  return NextResponse.json({ ok: importedCount > 0, importedCount, results })
}