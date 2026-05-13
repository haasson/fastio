#!/usr/bin/env node
// Автогенерация index.ts (barrel) для модулей в apps/storefront/features/<X>/.
//
// Большинство storefront-barrel'ов написаны вручную с селективными ре-экспортами
// (`export { foo, type Bar } from './stores/foo'`), потому что часто нужно
// переименование/переэкспорт типов. Этот скрипт — опт-ин: трогает только те
// index.ts, где есть маркер `// @generated-barrel`. Для всех остальных —
// warning и skip.
//
// Правила:
//   • Сканит подпапки: api/, composables/, utils/, stores/
//   • TS-файлы → ре-экспорт через `export *`
//   • Vue-файлы НЕ ре-экспортятся (компоненты импортятся deep-path)
//   • Пропускает файл если:
//       - имя начинается с `_` (private, конвенция)
//       - первая значимая строка содержит `// barrel:skip`
//       - имя = `feature.manifest.ts`
//   • Сохраняет ручные barrel'ы: если в index.ts нет маркера `// @generated-barrel`,
//     выводит warning и не трогает файл. С флагом --force всё равно перезаписывает.
//   • С --check: ничего не пишет, exit 1 если файл устарел (для CI).
//
// Usage:
//   node scripts/storefront-features/gen-barrels.mjs              # обновить (только маркированные)
//   node scripts/storefront-features/gen-barrels.mjs --check      # CI mode
//   node scripts/storefront-features/gen-barrels.mjs --force      # перезаписать ВСЕ
//   node scripts/storefront-features/gen-barrels.mjs --feature=cart  # одна фича

import fs from 'node:fs'
import path from 'node:path'
import url from 'node:url'

const __dirname = path.dirname(url.fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '../..')
const FEATURES_DIR = path.join(ROOT, 'apps/storefront/features')

const MARKER = '// @generated-barrel'
const SCAN_SUBDIRS = ['api', 'composables', 'utils', 'stores']
const SKIP_FILES = new Set(['feature.manifest.ts'])

const args = process.argv.slice(2)
const CHECK = args.includes('--check')
const FORCE = args.includes('--force')
const ONLY = args.find((a) => a.startsWith('--feature='))?.split('=')[1]

const issues = []
const updated = []
const skipped = []

function shouldSkipFile(filePath, name) {
  if (name.startsWith('_')) return true
  if (SKIP_FILES.has(name)) return true
  if (!name.endsWith('.ts')) return true
  if (name.endsWith('.d.ts')) return true
  if (name.endsWith('.test.ts') || name.endsWith('.spec.ts')) return true
  // Inline-маркер в файле
  const head = fs.readFileSync(filePath, 'utf8').split('\n', 5).join('\n')
  if (/\/\/\s*barrel:skip/.test(head)) return true
  return false
}

function collectExports(featureDir) {
  const lines = []
  // Корневой types.ts — реэкспорт доменных типов фичи (cross-module).
  // Подхватываем только если файл реально содержит экспорты (не `export {}`-заглушку).
  const typesFile = path.join(featureDir, 'types.ts')
  if (fs.existsSync(typesFile)) {
    const src = fs.readFileSync(typesFile, 'utf8')
    const hasRealExports = /export\s+(?!\{\s*\})/.test(src)
    if (hasRealExports) lines.push(`export * from './types'`)
  }
  for (const sub of SCAN_SUBDIRS) {
    const dir = path.join(featureDir, sub)
    if (!fs.existsSync(dir)) continue
    const files = fs.readdirSync(dir).sort()
    for (const f of files) {
      const full = path.join(dir, f)
      if (!fs.statSync(full).isFile()) continue
      if (shouldSkipFile(full, f)) continue
      const base = f.replace(/\.ts$/, '')
      lines.push(`export * from './${sub}/${base}'`)
    }
  }
  return lines
}

function buildBarrel(featureName, lines) {
  const header = [
    MARKER,
    `// Авто-сгенерировано scripts/storefront-features/gen-barrels.mjs.`,
    `// НЕ редактируй вручную — пометь файл префиксом _ или строкой "// barrel:skip"`,
    `// чтобы исключить его из barrel'а.`,
    `// Фича: ${featureName}`,
    '',
  ].join('\n')
  return header + lines.join('\n') + (lines.length ? '\n' : '')
}

function processFeature(featureName) {
  const dir = path.join(FEATURES_DIR, featureName)
  if (!fs.statSync(dir).isDirectory()) return
  const indexPath = path.join(dir, 'index.ts')
  const lines = collectExports(dir)
  const newContent = buildBarrel(featureName, lines)

  if (!fs.existsSync(indexPath)) {
    if (CHECK) {
      issues.push(`[${featureName}] index.ts отсутствует`)
      return
    }
    fs.writeFileSync(indexPath, newContent)
    updated.push(featureName)
    return
  }

  const existing = fs.readFileSync(indexPath, 'utf8')
  const isGenerated = existing.includes(MARKER)

  if (!isGenerated && !FORCE) {
    skipped.push(`${featureName} (ручной barrel — добавь маркер ${MARKER.trim()} или используй --force)`)
    return
  }

  if (existing === newContent) return

  if (CHECK) {
    issues.push(`[${featureName}] index.ts устарел (запусти gen-barrels.mjs)`)
    return
  }

  fs.writeFileSync(indexPath, newContent)
  updated.push(featureName)
}

function main() {
  const features = ONLY
    ? [ONLY]
    : fs.readdirSync(FEATURES_DIR, { withFileTypes: true })
        .filter((d) => d.isDirectory() && !d.name.startsWith('_') && !d.name.startsWith('.'))
        .map((d) => d.name)

  for (const f of features) processFeature(f)

  if (skipped.length) {
    console.log(`\nПропущено (ручной barrel): ${skipped.length}`)
    for (const s of skipped) console.log('  • ' + s)
  }
  if (updated.length) {
    console.log(`\n${CHECK ? 'Изменится' : 'Обновлено'}: ${updated.length}`)
    for (const f of updated) console.log('  • ' + f)
  }
  if (issues.length) {
    console.log(`\n✖ Проблемы:`)
    for (const i of issues) console.log('  ' + i)
    process.exit(1)
  }
  if (!skipped.length && !updated.length) console.log('Всё актуально.')
}

main()
