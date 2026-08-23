import { readdir, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { formatRecipeIssues, parseRecipe } from '../src/index.ts'

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures')
const files = (await readdir(fixturesDir)).filter((name) => name.endsWith('.json'))

let failed = 0
for (const file of files) {
  const raw = JSON.parse(await readFile(join(fixturesDir, file), 'utf8'))
  try {
    const recipe = parseRecipe(raw)
    console.log(`✓ ${file} → ${recipe.title}（${recipe.ingredients.length} 种食材 / ${recipe.steps.length} 步）`)
  } catch (error) {
    failed += 1
    const issues = formatRecipeIssues(error)
    console.error(`✗ ${file}`)
    for (const issue of issues) console.error(`    ${issue}`)
  }
}

if (files.length === 0) {
  console.error('fixtures 目录为空，没有可校验的样例')
  process.exit(1)
}
if (failed > 0) {
  console.error(`${failed}/${files.length} 个样例未通过校验`)
  process.exit(1)
}
console.log(`全部 ${files.length} 个样例通过 recipe.v1 校验`)
