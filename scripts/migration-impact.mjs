#!/usr/bin/env node
// Обратный поиск: SQL-миграция → список фич, которые её трогают.
//
// Зачем: открыл `supabase/migrations/233_add_column_to_appointments.sql` и
// сразу видишь — фичи admin.appointments и storefront.appointments читают эту
// таблицу, нужно перепроверить их api/composables после применения.
//
// Парсит SQL (CREATE/ALTER/DROP TABLE, CREATE OR REPLACE FUNCTION/VIEW),
// собирает имена таблиц и RPC, кросс-референсит с manifest.db.tables / db.rpc
// всех фич admin+storefront.
//
// Usage:
//   node scripts/migration-impact.mjs supabase/migrations/263_telegram_notify_internal_secret.sql
//   node scripts/migration-impact.mjs supabase/migrations/26{3,4,5}_*.sql   # несколько
//   node scripts/migration-impact.mjs --json supabase/migrations/263_*.sql
//
// Парсер — простой regex по top-level statements. Не понимает:
//   • динамический SQL (EXECUTE format(...))
//   • dollar-quoted блоки внутри функций (тело функции не сканируется)
// Этого достаточно для типичных миграций fastio.

import fs from 'node:fs'
import path from 'node:path'
import url from 'node:url'
import { Project, SyntaxKind } from 'ts-morph'

const __dirname = path.dirname(url.fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

const APPS = {
  admin: path.join(ROOT, 'apps/admin/features'),
  storefront: path.join(ROOT, 'apps/storefront/features'),
}

const args = process.argv.slice(2)
const JSON_OUT = args.includes('--json')
const files = args.filter((a) => !a.startsWith('--'))

if (files.length === 0) {
  console.error('Usage: node scripts/migration-impact.mjs <migration.sql> [migration.sql...]')
  console.error('       node scripts/migration-impact.mjs --json <migration.sql>')
  process.exit(2)
}

// ─── Manifest parser (общий с audit-deps) ───────────────────────────────

const project = new Project({
  useInMemoryFileSystem: false,
  skipAddingFilesFromTsConfig: true,
  skipFileDependencyResolution: true,
  skipLoadingLibFiles: true,
  compilerOptions: { isolatedModules: true, skipLibCheck: true, noResolve: true },
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

function parseManifestDb(filePath) {
  const src = project.addSourceFileAtPath(filePath)
  try {
    const exportAssign = src.getExportAssignment(() => true)
    if (!exportAssign) return null
    const expr = exportAssign.getExpression()
    if (expr.getKind() !== SyntaxKind.CallExpression) return null
    const objLit = expr.getArguments()[0]
    if (!objLit || objLit.getKind() !== SyntaxKind.ObjectLiteralExpression) return null
    const key = readString(getProp(objLit, 'key'))
    const dbProp = getProp(objLit, 'db')
    if (!dbProp || dbProp.getKind() !== SyntaxKind.ObjectLiteralExpression) {
      return { key, tables: [], rpc: [] }
    }
    const tables = readStringArray(getProp(dbProp, 'tables'))
    const rpc = readStringArray(getProp(dbProp, 'rpc'))
    return { key, tables, rpc }
  } finally {
    project.removeSourceFile(src)
  }
}

function collectFeatureIndex() {
  // Map: table → Set<'app/feature'>, rpc → Set<'app/feature'>
  const tableIndex = new Map()
  const rpcIndex = new Map()
  for (const [app, dir] of Object.entries(APPS)) {
    if (!fs.existsSync(dir)) continue
    const features = fs.readdirSync(dir, { withFileTypes: true })
      .filter((d) => d.isDirectory() && !d.name.startsWith('_') && !d.name.startsWith('.'))
      .map((d) => d.name)
    for (const f of features) {
      const manifestPath = path.join(dir, f, 'feature.manifest.ts')
      if (!fs.existsSync(manifestPath)) continue
      const parsed = parseManifestDb(manifestPath)
      if (!parsed) continue
      const id = `${app}/${f}`
      for (const t of parsed.tables) {
        if (!tableIndex.has(t)) tableIndex.set(t, new Set())
        tableIndex.get(t).add(id)
      }
      for (const r of parsed.rpc) {
        if (!rpcIndex.has(r)) rpcIndex.set(r, new Set())
        rpcIndex.get(r).add(id)
      }
    }
  }
  return { tableIndex, rpcIndex }
}

// ─── SQL parser ─────────────────────────────────────────────────────────

// Срезаем dollar-quoted блоки (тела функций), чтобы не ловить statements внутри
// них. Поддерживаются $$, $foo$ варианты.
function stripDollarQuoted(sql) {
  return sql.replace(/\$([A-Za-z_][\w]*)?\$[\s\S]*?\$\1\$/g, ' /* body */ ')
}

function stripComments(sql) {
  // Строчные комментарии и /* ... */ блоки.
  return sql.replace(/--[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, ' ')
}

// Имена объектов в PostgreSQL: identifier или "quoted identifier", может быть
// "schema.name". Для миграций fastio схема почти всегда public, но возьмём
// last segment как имя.
const IDENT = `(?:"[^"]+"|[A-Za-z_][\\w$]*)`
const QUALIFIED = `(?:${IDENT}\\.)?(${IDENT})`

function unquote(name) {
  return name.replace(/^"(.+)"$/, '$1')
}

function parseMigration(sql) {
  const cleaned = stripDollarQuoted(stripComments(sql))
  const tables = new Set()
  const functions = new Set()
  const views = new Set()

  const patterns = [
    // CREATE TABLE [IF NOT EXISTS] [schema.]name
    [new RegExp(`\\bCREATE\\s+(?:UNLOGGED\\s+|TEMP\\s+|TEMPORARY\\s+)?TABLE\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?${QUALIFIED}`, 'gi'), tables],
    // ALTER TABLE [IF EXISTS] [ONLY] [schema.]name
    [new RegExp(`\\bALTER\\s+TABLE\\s+(?:IF\\s+EXISTS\\s+)?(?:ONLY\\s+)?${QUALIFIED}`, 'gi'), tables],
    // DROP TABLE [IF EXISTS] [schema.]name
    [new RegExp(`\\bDROP\\s+TABLE\\s+(?:IF\\s+EXISTS\\s+)?${QUALIFIED}`, 'gi'), tables],
    // CREATE [OR REPLACE] FUNCTION [schema.]name
    [new RegExp(`\\bCREATE\\s+(?:OR\\s+REPLACE\\s+)?FUNCTION\\s+${QUALIFIED}`, 'gi'), functions],
    // DROP FUNCTION [IF EXISTS] [schema.]name
    [new RegExp(`\\bDROP\\s+FUNCTION\\s+(?:IF\\s+EXISTS\\s+)?${QUALIFIED}`, 'gi'), functions],
    // CREATE [OR REPLACE] [MATERIALIZED] VIEW [schema.]name
    [new RegExp(`\\bCREATE\\s+(?:OR\\s+REPLACE\\s+)?(?:MATERIALIZED\\s+)?VIEW\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?${QUALIFIED}`, 'gi'), views],
    // DROP VIEW [IF EXISTS] [schema.]name
    [new RegExp(`\\bDROP\\s+(?:MATERIALIZED\\s+)?VIEW\\s+(?:IF\\s+EXISTS\\s+)?${QUALIFIED}`, 'gi'), views],
  ]

  for (const [re, set] of patterns) {
    let m
    while ((m = re.exec(cleaned)) !== null) set.add(unquote(m[1]))
  }

  return {
    tables: [...tables].sort(),
    functions: [...functions].sort(),
    views: [...views].sort(),
  }
}

// ─── Main ───────────────────────────────────────────────────────────────

const { tableIndex, rpcIndex } = collectFeatureIndex()

const reports = []
for (const f of files) {
  if (!fs.existsSync(f)) {
    console.error(`File not found: ${f}`)
    continue
  }
  const sql = fs.readFileSync(f, 'utf8')
  const parsed = parseMigration(sql)
  const featuresHit = new Set()
  const tableFeatures = {}
  for (const t of parsed.tables) {
    const fs_ = tableIndex.get(t)
    if (fs_) {
      tableFeatures[t] = [...fs_].sort()
      fs_.forEach((id) => featuresHit.add(id))
    } else {
      tableFeatures[t] = []
    }
  }
  const rpcFeatures = {}
  for (const r of parsed.functions) {
    const fs_ = rpcIndex.get(r)
    if (fs_) {
      rpcFeatures[r] = [...fs_].sort()
      fs_.forEach((id) => featuresHit.add(id))
    } else {
      rpcFeatures[r] = []
    }
  }
  reports.push({
    file: path.relative(ROOT, f),
    tables: parsed.tables,
    functions: parsed.functions,
    views: parsed.views,
    tableFeatures,
    rpcFeatures,
    featuresHit: [...featuresHit].sort(),
  })
}

if (JSON_OUT) {
  console.log(JSON.stringify(reports, null, 2))
  process.exit(0)
}

for (const r of reports) {
  console.log(`\n▸ ${r.file}`)
  if (r.tables.length) {
    console.log(`  Таблицы (${r.tables.length}):`)
    for (const t of r.tables) {
      const owners = r.tableFeatures[t]
      const tail = owners.length ? `→ ${owners.join(', ')}` : '— не упомянута ни в одном manifest'
      console.log(`    • ${t}  ${tail}`)
    }
  }
  if (r.functions.length) {
    console.log(`  Функции (${r.functions.length}):`)
    for (const fn of r.functions) {
      const owners = r.rpcFeatures[fn]
      const tail = owners.length ? `→ ${owners.join(', ')}` : '— не упомянута ни в одном manifest'
      console.log(`    • ${fn}  ${tail}`)
    }
  }
  if (r.views.length) {
    console.log(`  Views (${r.views.length}): ${r.views.join(', ')}`)
  }
  if (r.featuresHit.length) {
    console.log(`  ⇒ Фичи на ревью: ${r.featuresHit.join(', ')}`)
  } else if (r.tables.length || r.functions.length) {
    console.log(`  ⇒ Нет фич, объявляющих эти объекты в manifest.db (возможно нужна актуализация)`)
  }
}
