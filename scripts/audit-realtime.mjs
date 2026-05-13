#!/usr/bin/env node
// Realtime channel registry: единая картина Supabase Realtime-подписок монорепо.
//
// Зачем: каналы раскиданы по features/*/composables/use*Channel.ts (admin) и
// features/*/composables/use*Realtime.ts (storefront). Когда меняется схема
// (drop column в realtime-table), легко пропустить consumer'а. Этот скрипт
// собирает все каналы в одну таблицу и сверяет с feature.manifest.ts > realtime.
//
// Что сканируется (regex по 5 паттернам):
//   1. .on('postgres_changes', { table: 'X', filter: '...' })  — прямой
//   2. useRealtimeWatch('X', ...)                              — admin hook
//   3. useRealtimeList({ table: 'X', filter: ... })            — admin hook
//   4. realtimeApi.subscribeToTable(_, _, 'X', filter, _)      — admin api
//   5. createRealtimeBus({ table: 'X', ... })                  — admin bus
//
// Что выводится:
//   ✖ ERROR  — канал найден в коде, но не объявлен в manifest.realtime
//   ⚠ WARN   — manifest.realtime объявляет таблицу, но в коде нет потребителя
//
// Flags:
//   --json
//   --strict   stale → error
//   --fix      перезаписывает manifest.realtime по фактическим каналам в коде
//              (channelComposable вычисляется из имени файла)
//
// Usage:
//   node scripts/audit-realtime.mjs
//   node scripts/audit-realtime.mjs --fix

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

const args = process.argv.slice(2)
const JSON_OUT = args.includes('--json')
const STRICT = args.includes('--strict')
const FIX = args.includes('--fix')

// ─── Manifest parser ────────────────────────────────────────────────────

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
const getProp = (obj, name) => {
  const p = obj.getProperty(name)
  if (!p || p.getKind() !== SyntaxKind.PropertyAssignment) return null
  return p.getInitializer()
}

function quoteToken(s) {
  return `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
}

// Перезаписывает realtime[] в manifest на новый список.
// Подстановка — через raw text-replace (см. историю audit-deps #1: ts-morph
// замазывает индентацию для multi-line литералов в существующих свойствах).
function rewriteManifestRealtime(filePath, entries) {
  const src = project.addSourceFileAtPath(filePath)
  try {
    const exportAssign = src.getExportAssignment(() => true)
    if (!exportAssign) return false
    const expr = exportAssign.getExpression()
    if (expr.getKind() !== SyntaxKind.CallExpression) return false
    const objLit = expr.getArguments()[0]
    if (!objLit || objLit.getKind() !== SyntaxKind.ObjectLiteralExpression) return false

    if (entries.length === 0) {
      const existing = objLit.getProperty('realtime')
      if (existing) existing.remove()
      src.saveSync()
      return true
    }

    const propIndent = '  '
    const itemIndent = '    '
    const lines = entries.map((e) => {
      const events = '[' + e.events.map(quoteToken).join(', ') + ']'
      return `${itemIndent}{ table: ${quoteToken(e.table)}, channelComposable: ${quoteToken(e.composable)}, events: ${events} }`
    })
    const arrayText = '[\n' + lines.join(',\n') + ',\n' + propIndent + ']'

    const existing = objLit.getProperty('realtime')
    if (existing) {
      const init = existing.getInitializer()
      if (!init) return false
      const start = init.getStart()
      const end = init.getEnd()
      const before = src.getFullText().slice(0, start)
      const after = src.getFullText().slice(end)
      src.replaceWithText(before + arrayText + after)
    } else {
      objLit.addPropertyAssignment({ name: 'realtime', initializer: arrayText })
    }
    src.saveSync()
    return true
  } finally {
    project.removeSourceFile(src)
  }
}

// Вычисляет имя composable из пути файла (e.g. useTableCallsChannel.ts → useTableCallsChannel).
// Для useRealtimeList/useRealtimeWatch внутри обычных composables — берёт имя файла.
function composableFromFile(file) {
  const base = path.basename(file).replace(/\.(ts|mts)$/, '')
  return base
}

function parseManifestRealtime(filePath) {
  const src = project.addSourceFileAtPath(filePath)
  try {
    const exportAssign = src.getExportAssignment(() => true)
    if (!exportAssign) return null
    const expr = exportAssign.getExpression()
    if (expr.getKind() !== SyntaxKind.CallExpression) return null
    const objLit = expr.getArguments()[0]
    if (!objLit || objLit.getKind() !== SyntaxKind.ObjectLiteralExpression) return null
    const realtimeProp = getProp(objLit, 'realtime')
    if (!realtimeProp || realtimeProp.getKind() !== SyntaxKind.ArrayLiteralExpression) return []
    const entries = []
    for (const el of realtimeProp.getElements()) {
      if (el.getKind() !== SyntaxKind.ObjectLiteralExpression) continue
      const table = readString(getProp(el, 'table'))
      const composable = readString(getProp(el, 'channelComposable'))
      if (table) entries.push({ table, composable })
    }
    return entries
  } finally {
    project.removeSourceFile(src)
  }
}

// ─── Scanner ────────────────────────────────────────────────────────────

const SCAN_EXTS = new Set(['.ts', '.mts'])

function* walkFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const e of entries) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name.startsWith('.') || e.name === '__tests__') continue
      yield* walkFiles(full)
    } else if (e.isFile()) {
      if (e.name === 'feature.manifest.ts') continue
      if (e.name.endsWith('.d.ts')) continue
      const ext = path.extname(e.name)
      if (SCAN_EXTS.has(ext)) yield full
    }
  }
}

// Дефолтные события для composable'ов, которые внутренне подписываются на всё.
// (useRealtimeList/useRealtimeWatch/createRealtimeBus используют event: '*'.)
const ALL_EVENTS = ['insert', 'update', 'delete']

// Нормализация event-строки: 'INSERT' → ['insert'], '*' → all, 'insert,update' → split.
function normalizeEvents(raw) {
  if (!raw || raw === '*') return ALL_EVENTS
  return raw
    .split(/[,|]/)
    .map((s) => s.trim().toLowerCase())
    .filter((s) => ['insert', 'update', 'delete'].includes(s))
}

// Объект-литерал-аргументы парсим эвристикой: найти место входа в вызов
// (например `useRealtimeList(`), потом в окне поискать `table: '...'`,
// `filter: ...`, `event: '...'`. Окно 2000 — с запасом на длинные inline-конфиги.

function extractCallOptions(source, startIdx, windowSize = 2000) {
  const win = source.slice(startIdx, startIdx + windowSize)
  const t = win.match(/table:\s*['"]([^'"]+)['"]/)
  if (!t) return null
  const f = win.match(/filter:\s*([^,\n}]+)/)
  const ev = win.match(/event:\s*['"]([^'"]+)['"]/)
  return {
    table: t[1],
    filter: f ? f[1].trim() : null,
    events: ev ? normalizeEvents(ev[1]) : ALL_EVENTS,
  }
}

const PATTERNS = [
  // 1. .on('postgres_changes', { event: 'X', table: 'X', filter: '...' })
  {
    re: /\.on\(\s*['"]postgres_changes['"]\s*,\s*\{/g,
    extract: (m, source) => {
      const r = extractCallOptions(source, m.index)
      return r ? { ...r, via: 'direct' } : null
    },
  },
  // 2. useRealtimeWatch('table', ...) — внутри слушает все события
  {
    re: /useRealtimeWatch\(\s*['"]([^'"]+)['"]/g,
    extract: (m) => ({ table: m[1], filter: null, events: ALL_EVENTS, via: 'useRealtimeWatch' }),
  },
  // 3. useRealtimeList({ ..., table: 'X', filter: ... }) — может быть с дженериком
  {
    re: /useRealtimeList(?:<[^>]+>)?\(\s*\{/g,
    extract: (m, source) => {
      const r = extractCallOptions(source, m.index)
      return r ? { ...r, via: 'useRealtimeList' } : null
    },
  },
  // 4. realtimeApi.subscribeToTable(sb, key, 'X', filter, ...)
  {
    re: /subscribeToTable\(\s*[^,]+,\s*[^,]+,\s*['"]([^'"]+)['"]\s*,\s*([^,]+)/g,
    extract: (m) => ({ table: m[1], filter: m[2].trim(), events: ALL_EVENTS, via: 'subscribeToTable' }),
  },
  // 5. createRealtimeBus({ table: 'X', ... })
  {
    re: /createRealtimeBus(?:<[^>]+>)?\(\s*\{/g,
    extract: (m, source) => {
      const r = extractCallOptions(source, m.index)
      return r ? { ...r, via: 'createRealtimeBus' } : null
    },
  },
]

function scanFile(filePath) {
  const source = fs.readFileSync(filePath, 'utf8')
  const hits = []
  for (const p of PATTERNS) {
    p.re.lastIndex = 0
    let m
    while ((m = p.re.exec(source)) !== null) {
      const result = p.extract(m, source)
      if (result) hits.push(result)
    }
  }
  return hits
}

// ─── Build registry ─────────────────────────────────────────────────────

const usage = [] // { app, feature, table, filter, via, file }
const declared = [] // { app, feature, table, composable }

for (const [app, baseDir] of Object.entries(APPS)) {
  if (!fs.existsSync(baseDir)) continue
  const features = fs.readdirSync(baseDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith('_') && !d.name.startsWith('.'))
    .map((d) => d.name)
  for (const f of features) {
    const featureDir = path.join(baseDir, f)
    const manifestPath = path.join(featureDir, 'feature.manifest.ts')
    if (fs.existsSync(manifestPath)) {
      const entries = parseManifestRealtime(manifestPath)
      for (const e of entries) declared.push({ app, feature: f, ...e })
    }
    for (const file of walkFiles(featureDir)) {
      const hits = scanFile(file)
      for (const h of hits) {
        usage.push({
          app,
          feature: f,
          table: h.table,
          filter: h.filter,
          events: h.events ?? ALL_EVENTS,
          via: h.via,
          file: path.relative(ROOT, file),
        })
      }
    }
  }
}

// ─── Diff usage vs declared ─────────────────────────────────────────────

function keyOf(app, feature, table) { return `${app}/${feature}:${table}` }

const usedKeys = new Set(usage.map((u) => keyOf(u.app, u.feature, u.table)))
const declaredKeys = new Set(declared.map((d) => keyOf(d.app, d.feature, d.table)))

const errors = []  // в коде, не в manifest
const warnings = [] // в manifest, не в коде

const seenErr = new Set()
for (const u of usage) {
  const k = keyOf(u.app, u.feature, u.table)
  if (declaredKeys.has(k)) continue
  if (seenErr.has(k)) continue
  seenErr.add(k)
  errors.push({ ...u })
}

for (const d of declared) {
  const k = keyOf(d.app, d.feature, d.table)
  if (usedKeys.has(k)) continue
  warnings.push({ ...d })
}

// ─── Render ─────────────────────────────────────────────────────────────

// ─── Fix ────────────────────────────────────────────────────────────────

if (FIX) {
  // Группируем usage по (app, feature) → уникальные { table → { composable, events } }
  const byFeature = new Map()
  for (const u of usage) {
    const id = `${u.app}/${u.feature}`
    if (!byFeature.has(id)) byFeature.set(id, new Map())
    const tableMap = byFeature.get(id)
    const composable = composableFromFile(u.file)
    if (!tableMap.has(u.table)) {
      tableMap.set(u.table, { composable, events: new Set(u.events) })
    } else {
      // Несколько потребителей одной таблицы — объединяем events.
      const cur = tableMap.get(u.table)
      for (const e of u.events) cur.events.add(e)
    }
  }
  // Включаем все фичи, у которых либо есть usage, либо что-то объявлено
  const allFeatures = new Set([...byFeature.keys()])
  for (const d of declared) allFeatures.add(`${d.app}/${d.feature}`)

  const fixed = []
  for (const id of allFeatures) {
    const [app, feature] = id.split('/')
    const manifestPath = path.join(APPS[app], feature, 'feature.manifest.ts')
    if (!fs.existsSync(manifestPath)) continue
    const tableMap = byFeature.get(id) ?? new Map()
    const entries = [...tableMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([table, { composable, events }]) => ({
        table,
        composable,
        // Стабильный порядок events
        events: ALL_EVENTS.filter((e) => events.has(e)),
      }))
    // Существующее объявление
    const existing = declared.filter((d) => d.app === app && d.feature === feature)
    const existingKey = existing.map((e) => `${e.table}|${e.composable}`).sort().join(',')
    const newKey = entries.map((e) => `${e.table}|${e.composable}`).sort().join(',')
    if (existingKey === newKey) continue
    rewriteManifestRealtime(manifestPath, entries)
    fixed.push(id)
  }
  if (fixed.length) {
    console.log(`Обновлено manifest.realtime: ${fixed.length}`)
    for (const f of fixed) console.log(`  • ${f}`)
  } else {
    console.log('Нечего фиксить — все manifest.realtime консистентны.')
  }
  process.exit(0)
}

if (JSON_OUT) {
  console.log(JSON.stringify({ usage, declared, errors, warnings }, null, 2))
  process.exit(errors.length ? 1 : 0)
}

// Markdown-таблица всех каналов
console.log('\n# Realtime channel registry\n')
console.log('| App | Feature | Table | Via | Filter | File |')
console.log('|---|---|---|---|---|---|')
const sorted = usage.slice().sort((a, b) => (a.app + a.feature + a.table).localeCompare(b.app + b.feature + b.table))
for (const u of sorted) {
  const filter = u.filter ? '`' + u.filter.replace(/\|/g, '\\|') + '`' : '—'
  console.log(`| ${u.app} | ${u.feature} | \`${u.table}\` | ${u.via} | ${filter} | ${u.file} |`)
}

if (errors.length) {
  console.log(`\n## ✖ Каналы в коде, но не в manifest.realtime (${errors.length})\n`)
  for (const e of errors) console.log(`  • ${e.app}/${e.feature} → \`${e.table}\` (${e.via}, ${e.file})`)
}

if (warnings.length) {
  console.log(`\n## ⚠ manifest.realtime объявляет, но нет потребителя в коде (${warnings.length})\n`)
  for (const w of warnings) console.log(`  • ${w.app}/${w.feature} → \`${w.table}\`${w.composable ? ` (composable: ${w.composable})` : ''}`)
}

if (!errors.length && !warnings.length) {
  console.log('\n✓ Все realtime-каналы консистентны с manifest.realtime.')
}

if (errors.length > 0) process.exit(1)
if (STRICT && warnings.length > 0) process.exit(1)
process.exit(0)
