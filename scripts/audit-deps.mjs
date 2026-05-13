#!/usr/bin/env node
// Аудит зависимостей фич: реальные импорты vs feature.manifest.ts > dependsOn.
//
// Что проверяет:
//   ERROR  — модуль импортит что-то, чего нет в manifest.dependsOn (missing).
//   WARN   — manifest.dependsOn объявляет зависимость, которую никто не импортит (stale).
//
// Покрытие импортов (нормализуются к формату dependsOn):
//   ~/shared/<dir>/<name>...        → shared.<dir>.<name>
//   ~/features/<key>/...            → features.<key>
//   @fastio/<pkg>/...               → @fastio/<pkg>
// Прочее (relative ./, внешние vue/pinia/dayjs, #imports, nuxt/...) — игнорируется.
//
// Источники импортов: .ts, .vue (внутри <script> блоков).
//
// Flags:
//   --scope=admin|storefront|all  (default all)
//   --feature=<key>               прогон по одной фиче
//   --strict                      stale → error (для CI)
//   --graph                       вывод mermaid-диаграммы вместо обычного отчёта
//   --json                        машиночитаемый JSON
//   --fix                         автоматически приводит manifest.dependsOn к реальным
//                                 импортам (добавляет missing, удаляет stale)
//
// Usage:
//   node scripts/audit-deps.mjs
//   node scripts/audit-deps.mjs --scope=admin --feature=appointments
//   node scripts/audit-deps.mjs --graph > deps.mmd

import fs from 'node:fs'
import path from 'node:path'
import url from 'node:url'
import { IndentationText, Project, QuoteKind, SyntaxKind } from 'ts-morph'

const __dirname = path.dirname(url.fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

const APPS = {
  admin: path.join(ROOT, 'apps/admin/features'),
  storefront: path.join(ROOT, 'apps/storefront/features'),
}

// Корень pages/ — куда Nuxt складывает страницы (вне features/). manifest.routes
// объявляет реальные пути; для каждого пытаемся найти соответствующий .vue файл
// в pages/ и сканить как часть фичи. Иначе тонкие фичи (auth, у которой pages/login.vue
// лежит в admin/pages/, а не в admin/features/auth/) выглядят пустыми по импортам.
const PAGES_ROOTS = {
  admin: path.join(ROOT, 'apps/admin/pages'),
  storefront: path.join(ROOT, 'apps/storefront/pages'),
}

// ─── CLI ────────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const SCOPE = (args.find((a) => a.startsWith('--scope='))?.split('=')[1] ?? 'all').toLowerCase()
const ONLY = args.find((a) => a.startsWith('--feature='))?.split('=')[1]
const STRICT = args.includes('--strict')
const GRAPH = args.includes('--graph')
const JSON_OUT = args.includes('--json')
const FIX = args.includes('--fix')

if (!['admin', 'storefront', 'all'].includes(SCOPE)) {
  console.error(`Unknown --scope=${SCOPE}. Use admin|storefront|all.`)
  process.exit(2)
}

// ─── Manifest parser (ts-morph) ─────────────────────────────────────────

const project = new Project({
  useInMemoryFileSystem: false,
  skipAddingFilesFromTsConfig: true,
  skipFileDependencyResolution: true,
  skipLoadingLibFiles: true,
  compilerOptions: { isolatedModules: true, skipLibCheck: true, noResolve: true },
  manipulationSettings: {
    indentationText: IndentationText.TwoSpaces,
    quoteKind: QuoteKind.Single,
  },
})

const readString = (n) => {
  if (!n) return null
  const k = n.getKind()
  if (k === SyntaxKind.StringLiteral || k === SyntaxKind.NoSubstitutionTemplateLiteral) return n.getLiteralText()
  return null
}
const readStringArray = (n) => {
  if (!n || n.getKind() !== SyntaxKind.ArrayLiteralExpression) return []
  return n.getElements().map(readString).filter(Boolean)
}
const getProp = (obj, name) => {
  const p = obj.getProperty(name)
  if (!p || p.getKind() !== SyntaxKind.PropertyAssignment) return null
  return p.getInitializer()
}

function parseManifest(filePath) {
  const src = project.addSourceFileAtPath(filePath)
  try {
    const exportAssign = src.getExportAssignment(() => true)
    if (!exportAssign) return null
    const expr = exportAssign.getExpression()
    if (expr.getKind() !== SyntaxKind.CallExpression) return null
    const objLit = expr.getArguments()[0]
    if (!objLit || objLit.getKind() !== SyntaxKind.ObjectLiteralExpression) return null
    const key = readString(getProp(objLit, 'key'))
    const dependsOn = readStringArray(getProp(objLit, 'dependsOn'))
    const routesProp = getProp(objLit, 'routes')
    const routes = []
    if (routesProp && routesProp.getKind() === SyntaxKind.ArrayLiteralExpression) {
      for (const el of routesProp.getElements()) {
        if (el.getKind() !== SyntaxKind.ObjectLiteralExpression) continue
        const p = readString(getProp(el, 'path'))
        if (p) routes.push(p)
      }
    }
    return { key, dependsOn, routes }
  } finally {
    project.removeSourceFile(src)
  }
}

// Эскейпит токен для безопасного вывода в single-quoted строку.
// Токены из реальных импортов никогда не содержат кавычек, но --fix —
// destructive операция, защищаемся от мусорного ввода.
function quoteToken(s) {
  return `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
}

// Перезаписывает массив dependsOn в manifest на новый список.
// Порядок: server.*, features.*, shared.*, @fastio/* — лексикографически внутри группы.
// Использует ts-morph только для поиска позиций; саму подстановку делаем сырым
// текстом, чтобы не зависеть от auto-indent инференса (см. историю #1: ts-morph
// добавлял +2 пробела к items при replaceWithText в storefront-манифестах).
function rewriteDependsOn(filePath, newList) {
  const src = project.addSourceFileAtPath(filePath)
  try {
    const exportAssign = src.getExportAssignment(() => true)
    if (!exportAssign) return { ok: false }
    const expr = exportAssign.getExpression()
    if (expr.getKind() !== SyntaxKind.CallExpression) return { ok: false }
    const objLit = expr.getArguments()[0]
    if (!objLit || objLit.getKind() !== SyntaxKind.ObjectLiteralExpression) return { ok: false }

    const sorted = sortDeps(newList)
    const propIndent = '  '
    const itemIndent = '    '
    const arrayText = sorted.length === 0
      ? '[]'
      : '[\n' + sorted.map((s) => itemIndent + quoteToken(s) + ',').join('\n') + '\n' + propIndent + ']'

    const existing = objLit.getProperty('dependsOn')
    if (existing) {
      // Проверка на inline-комментарии: ts-morph не сохранит их при ручной
      // подстановке. Если они есть — отказываем в авто-фиксе, человек правит руками.
      const fullText = existing.getFullText()
      const arrayBody = existing.getInitializer()?.getText() ?? ''
      const hasComment = /\/\/[^\n]*|\/\*[\s\S]*?\*\//.test(arrayBody)
      if (hasComment) {
        return { ok: false, reason: 'inline-comments' }
      }
      const init = existing.getInitializer()
      if (!init) return { ok: false }
      const start = init.getStart()
      const end = init.getEnd()
      const before = src.getFullText().slice(0, start)
      const after = src.getFullText().slice(end)
      src.replaceWithText(before + arrayText + after)
    } else {
      // Добавляем перед закрывающей скобкой объекта (ts-morph для новой prop
      // ничего не ломает, indent инферится корректно — там нет старого текста).
      objLit.addPropertyAssignment({ name: 'dependsOn', initializer: arrayText })
    }
    src.saveSync()
    return { ok: true }
  } finally {
    project.removeSourceFile(src)
  }
}

function sortDeps(arr) {
  const groups = { server: [], features: [], shared: [], pkg: [] }
  for (const d of arr) {
    if (d.startsWith('server.')) groups.server.push(d)
    else if (d.startsWith('features.')) groups.features.push(d)
    else if (d.startsWith('shared.')) groups.shared.push(d)
    else groups.pkg.push(d)
  }
  for (const g of Object.values(groups)) g.sort()
  return [...groups.features, ...groups.shared, ...groups.server, ...groups.pkg]
}

// ─── Import extraction ──────────────────────────────────────────────────

// Покрытие: статический `import [type] ... from 'X'`, lazy `import('X')`,
// `require('X')`. Динамический `import(spec)` с переменной — пропускаем
// (нечего матчить).
const IMPORT_RE = /import\s+(?:type\s+)?(?:[\s\S]*?\s+from\s+)?['"]([^'"\n]+)['"]/g
const DYNAMIC_IMPORT_RE = /\bimport\s*\(\s*['"]([^'"\n]+)['"]\s*\)/g
const REQUIRE_RE = /\brequire\s*\(\s*['"]([^'"\n]+)['"]\s*\)/g
const SCRIPT_RE = /<script[^>]*>([\s\S]*?)<\/script>/g

function extractImportSpecs(filePath) {
  const ext = path.extname(filePath)
  let source = fs.readFileSync(filePath, 'utf8')
  if (ext === '.vue') {
    const parts = []
    let m
    SCRIPT_RE.lastIndex = 0
    while ((m = SCRIPT_RE.exec(source)) !== null) parts.push(m[1])
    source = parts.join('\n')
  } else if (ext !== '.ts' && ext !== '.mts') {
    return []
  }
  const specs = []
  for (const re of [IMPORT_RE, DYNAMIC_IMPORT_RE, REQUIRE_RE]) {
    re.lastIndex = 0
    let m
    while ((m = re.exec(source)) !== null) specs.push(m[1])
  }
  return specs
}

// ─── Implicit deps (инфра — не обязаны к объявлению) ────────────────────
//
// Базовые пакеты и утилки доступны всем фичам по умолчанию. Если фича их
// импортит — это не missing; если объявляет — это не stale.
// Менять список — осознанно, чтобы не разводить шум в отчёте.

const IMPLICIT_DEPS = new Set([
  '@fastio/ui',
  '@fastio/icons',
  '@fastio/kit',
  '@fastio/styles',
  '@fastio/public-ui',
  'shared.utils.reportError',
  // shared.data.db-types — re-export типов Supabase (Database, Tables<>, Enums<>).
  // НЕ содержит runtime-кода, поэтому импорт не несёт смысловой зависимости
  // от data-слоя. Если файл начнёт экспортить функции — удалить отсюда.
  'shared.data.db-types',
])

// ─── Normalizer: import spec → dependsOn token ──────────────────────────

function normalizeSpec(spec) {
  if (!spec) return null
  // Внешние и невзаимоинтересные
  if (spec.startsWith('./') || spec.startsWith('../')) return null
  if (spec.startsWith('#')) return null // Nuxt magic (#imports, #app)
  if (spec.startsWith('nuxt/')) return null

  if (spec.startsWith('@fastio/')) {
    // @fastio/shared/foo → @fastio/shared
    const parts = spec.split('/')
    return `${parts[0]}/${parts[1]}`
  }
  if (spec.startsWith('~/shared/')) {
    const tail = spec.slice('~/shared/'.length).replace(/\.(ts|vue|mjs|js)$/, '')
    if (!tail) return null
    return 'shared.' + tail.split('/').filter(Boolean).join('.')
  }
  if (spec.startsWith('~/features/')) {
    const key = spec.slice('~/features/'.length).split('/')[0]
    return key ? `features.${key}` : null
  }
  // Остальные ~/-импорты (config, utils/api, components, columns, layouts, plugins, middleware)
  // не относятся к dependsOn-граничной модели — игнор.
  return null
}

// ─── Feature walker ─────────────────────────────────────────────────────

const SCAN_EXTS = new Set(['.ts', '.vue', '.mts'])

function* walkFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const e of entries) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name.startsWith('.')) continue
      yield* walkFiles(full)
    } else if (e.isFile()) {
      if (e.name === 'feature.manifest.ts') continue
      if (e.name.endsWith('.d.ts')) continue
      if (e.name.endsWith('.test.ts') || e.name.endsWith('.spec.ts')) continue
      const ext = path.extname(e.name)
      if (SCAN_EXTS.has(ext)) yield full
    }
  }
}

// Резолвит route-путь в файл pages/. Для '/login' → 'pages/login.vue' или
// 'pages/login/index.vue'. Для '/menu/dishes' → 'pages/menu/dishes.vue' и т.п.
function pageFileFor(app, routePath) {
  const cleaned = routePath.replace(/^\//, '')
  const candidates = [
    path.join(PAGES_ROOTS[app], `${cleaned}.vue`),
    path.join(PAGES_ROOTS[app], cleaned, 'index.vue'),
  ]
  return candidates.find((p) => fs.existsSync(p)) ?? null
}

function auditFeature(app, featureName, featureDir) {
  const manifestPath = path.join(featureDir, 'feature.manifest.ts')
  if (!fs.existsSync(manifestPath)) return null

  const parsed = parseManifest(manifestPath)
  if (!parsed) return null

  const declared = new Set(parsed.dependsOn)
  const used = new Set()

  const scanFile = (file) => {
    for (const spec of extractImportSpecs(file)) {
      const token = normalizeSpec(spec)
      if (!token) continue
      if (token === `features.${featureName}`) continue
      used.add(token)
    }
  }

  for (const file of walkFiles(featureDir)) scanFile(file)

  // Расширенный скан: файлы pages/, объявленные в manifest.routes.
  // Это даёт «правду» для тонких фич типа auth (login.vue в pages/, а не в features/).
  for (const routePath of parsed.routes ?? []) {
    const pageFile = pageFileFor(app, routePath)
    if (pageFile) scanFile(pageFile)
  }

  const missing = [...used].filter((t) => !declared.has(t) && !IMPLICIT_DEPS.has(t)).sort()
  // server.* — Nitro-эндпоинты, вызываются через $fetch('/api/...'), а не import.
  // Из импортов их не вывести, поэтому stale-проверка их игнорит.
  const stale = [...declared].filter((t) => !used.has(t) && !IMPLICIT_DEPS.has(t) && !t.startsWith('server.')).sort()

  return {
    app,
    feature: featureName,
    key: parsed.key ?? featureName,
    declared: [...declared].sort(),
    used: [...used].sort(),
    missing,
    stale,
  }
}

function collectScopes() {
  const apps = SCOPE === 'all' ? ['admin', 'storefront'] : [SCOPE]
  const results = []
  for (const app of apps) {
    const baseDir = APPS[app]
    if (!fs.existsSync(baseDir)) continue
    const features = fs.readdirSync(baseDir, { withFileTypes: true })
      .filter((d) => d.isDirectory() && !d.name.startsWith('_') && !d.name.startsWith('.'))
      .map((d) => d.name)
    for (const f of features) {
      if (ONLY && f !== ONLY) continue
      const report = auditFeature(app, f, path.join(baseDir, f))
      if (report) results.push(report)
    }
  }
  return results
}

// ─── Renderers ──────────────────────────────────────────────────────────

function renderGraph(reports) {
  const lines = ['graph LR']
  for (const r of reports) {
    const id = `${r.app}_${r.feature}`.replace(/-/g, '_')
    lines.push(`  ${id}["${r.app}/${r.feature}"]`)
    for (const dep of r.used) {
      const depId = dep.replace(/[.@/-]/g, '_')
      lines.push(`  ${id} --> ${depId}["${dep}"]`)
    }
  }
  return lines.join('\n')
}

function renderText(reports) {
  let totalMissing = 0
  let totalStale = 0
  const blocks = []
  for (const r of reports) {
    if (!r.missing.length && !r.stale.length) continue
    const parts = [`\n${r.app}/${r.feature}`]
    if (r.missing.length) {
      totalMissing += r.missing.length
      parts.push(`  ✖ missing (используется, не объявлено):`)
      for (const m of r.missing) parts.push(`      • ${m}`)
    }
    if (r.stale.length) {
      totalStale += r.stale.length
      parts.push(`  ⚠ stale (объявлено, не используется):`)
      for (const s of r.stale) parts.push(`      • ${s}`)
    }
    blocks.push(parts.join('\n'))
  }
  if (blocks.length === 0) return { text: '✓ Все dependsOn консистентны.\n', missing: 0, stale: 0 }
  return {
    text: blocks.join('\n') + `\n\nИтого: ${totalMissing} missing (error), ${totalStale} stale (warning).\n`,
    missing: totalMissing,
    stale: totalStale,
  }
}

// ─── Fix ────────────────────────────────────────────────────────────────

function applyFix(reports) {
  const fixed = []
  const skipped = []
  for (const r of reports) {
    if (!r.missing.length && !r.stale.length) continue
    const baseDir = APPS[r.app]
    const manifestPath = path.join(baseDir, r.feature, 'feature.manifest.ts')
    if (!fs.existsSync(manifestPath)) continue
    // Новый список = фактические импорты + сохранённые server.* токены.
    // server.* не выводимы из импортов (Nitro-эндпоинты вызываются через $fetch),
    // поэтому --fix не должен их выкидывать — это полезная документация.
    const fromImports = r.used.filter((u) => !IMPLICIT_DEPS.has(u))
    const preservedServer = r.declared.filter((d) => d.startsWith('server.'))
    const next = [...new Set([...fromImports, ...preservedServer])]
    const result = rewriteDependsOn(manifestPath, next)
    if (result.ok) {
      fixed.push(`${r.app}/${r.feature}`)
    } else if (result.reason === 'inline-comments') {
      skipped.push(`${r.app}/${r.feature} — есть inline-комментарии в dependsOn (правь руками, --fix их потеряет)`)
    }
  }
  return { fixed, skipped }
}

// ─── Main ───────────────────────────────────────────────────────────────

let reports = collectScopes()

if (FIX) {
  const { fixed, skipped } = applyFix(reports)
  if (fixed.length) {
    console.log(`Обновлено манифестов: ${fixed.length}`)
    for (const f of fixed) console.log(`  • ${f}`)
  } else {
    console.log('Нечего фиксить — все dependsOn уже консистентны или пропущены.')
  }
  if (skipped.length) {
    console.log(`\nПропущено: ${skipped.length}`)
    for (const s of skipped) console.log(`  • ${s}`)
  }
  // Пере-сбор после правки для финального отчёта
  reports = collectScopes()
}

if (JSON_OUT) {
  console.log(JSON.stringify(reports, null, 2))
  process.exit(reports.some((r) => r.missing.length) ? 1 : 0)
}

if (GRAPH) {
  console.log(renderGraph(reports))
  process.exit(0)
}

const { text, missing, stale } = renderText(reports)
process.stdout.write(text)

if (missing > 0) process.exit(1)
if (STRICT && stale > 0) process.exit(1)
process.exit(0)
