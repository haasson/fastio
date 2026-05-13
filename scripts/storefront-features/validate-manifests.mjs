#!/usr/bin/env node
// Валидатор storefront feature.manifest.ts + AGENTS.md.
//
// Что проверяет:
//   ERRORS (блокируют коммит):
//     • Фича содержит api/composables/stores → обязаны быть feature.manifest.ts И AGENTS.md
//     • routes[].path → файл реально существует в apps/storefront/pages/
//
//   WARNINGS (печатаются, не блокируют):
//     • Auto-detect рассинхрона:
//         - .from('x') / .rpc('y') в api/* не в manifest.db.tables / manifest.db.rpc
//         - manifest.db.tables упоминает таблицу, не используемую в api/*
//         - pages/<feature>/*.vue не упомянут в manifest.routes
//     • AGENTS.md staleness:
//         - Файл упомянут в "Карте модуля", но не существует
//         - Существует api/*.ts или composables/*.ts, не упомянутый в "Карте модуля"
//     • dependsOn shared.<x> → файл не найден
//
// Flags:
//   --strict           Превращает все warnings в errors (для CI)
//   --auto-fix         Автообновляет авто-генерируемые поля manifest (db.tables, db.rpc)
//   --feature=<name>   Прогон только по одной фиче
//
// Usage: node scripts/storefront-features/validate-manifests.mjs

import fs from 'node:fs'
import path from 'node:path'
import url from 'node:url'
import { Project, SyntaxKind } from 'ts-morph'

const __dirname = path.dirname(url.fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '../..')
const FEATURES_DIR = path.join(ROOT, 'apps/storefront/features')
const PAGES_DIR = path.join(ROOT, 'apps/storefront/pages')
const SHARED_DIR = path.join(ROOT, 'apps/storefront/shared')

const args = process.argv.slice(2)
const STRICT = args.includes('--strict')
const AUTO_FIX = args.includes('--auto-fix')
const ONLY = args.find((a) => a.startsWith('--feature='))?.split('=')[1]

const errors = []
const warnings = []
const fixed = []

const recordError = (feature, msg) => errors.push(`[${feature}] ${msg}`)
const recordWarning = (feature, msg) => warnings.push(`[${feature}] ${msg}`)

// ─── ts-morph ───────────────────────────────────────────────────────────

const makeProject = () => new Project({
  useInMemoryFileSystem: false,
  skipAddingFilesFromTsConfig: true,
  skipFileDependencyResolution: true,
  skipLoadingLibFiles: true,
  compilerOptions: { isolatedModules: true, skipLibCheck: true, noResolve: true },
})

const readStringLiteral = (n) => {
  if (!n) return null
  const k = n.getKind()
  if (k === SyntaxKind.StringLiteral || k === SyntaxKind.NoSubstitutionTemplateLiteral) return n.getLiteralText()
  return null
}
const readArrayOfStrings = (n) => {
  if (!n || n.getKind() !== SyntaxKind.ArrayLiteralExpression) return null
  return n.getElements().map((e) => readStringLiteral(e)).filter(Boolean)
}
const getProp = (obj, name) => {
  const p = obj.getProperty(name)
  if (!p || p.getKind() !== SyntaxKind.PropertyAssignment) return null
  return p.getInitializer()
}

function parseManifest(filePath) {
  const project = makeProject()
  const src = project.addSourceFileAtPath(filePath)
  const exportAssign = src.getExportAssignment(() => true)
  if (!exportAssign) return null
  const expr = exportAssign.getExpression()
  if (expr.getKind() !== SyntaxKind.CallExpression) return null
  const objLit = expr.getArguments()[0]
  if (!objLit || objLit.getKind() !== SyntaxKind.ObjectLiteralExpression) return null

  const key = readStringLiteral(getProp(objLit, 'key'))
  const dependsOn = readArrayOfStrings(getProp(objLit, 'dependsOn')) ?? []

  const routesNode = getProp(objLit, 'routes')
  const routes = []
  if (routesNode?.getKind() === SyntaxKind.ArrayLiteralExpression) {
    for (const el of routesNode.getElements()) {
      if (el.getKind() !== SyntaxKind.ObjectLiteralExpression) continue
      const p = readStringLiteral(getProp(el, 'path'))
      if (p) routes.push(p)
    }
  }

  const dbNode = getProp(objLit, 'db')
  let tables = []
  let rpc = []
  if (dbNode?.getKind() === SyntaxKind.ObjectLiteralExpression) {
    tables = readArrayOfStrings(getProp(dbNode, 'tables')) ?? []
    rpc = readArrayOfStrings(getProp(dbNode, 'rpc')) ?? []
  }

  // realtime: Array<{ table: '...' }> — table'ы из этого списка считаются легитимными
  // источниками для db.tables (даже если в api/ нет .from()).
  const realtimeNode = getProp(objLit, 'realtime')
  const realtimeTables = []
  if (realtimeNode?.getKind() === SyntaxKind.ArrayLiteralExpression) {
    for (const el of realtimeNode.getElements()) {
      if (el.getKind() !== SyntaxKind.ObjectLiteralExpression) continue
      const t = readStringLiteral(getProp(el, 'table'))
      if (t) realtimeTables.push(t)
    }
  }

  return { key, dependsOn, routes, tables, rpc, realtimeTables }
}

// ─── Auto-detect инфры из кода ──────────────────────────────────────────

function extractTablesAndRpcFromApi(featureDir) {
  // Сканим api/ (CRUD-обёртки) и composables/ (realtime-каналы) — на витрине большинство
  // прямых обращений к Supabase это .on('postgres_changes', { table: ... }) внутри
  // composables, а не .from() в api/.
  const tables = new Set()
  const rpc = new Set()
  const reFrom = /\.from\(\s*['"]([a-z_][a-z0-9_]*)['"]/g
  const reRpc = /\.rpc\(\s*['"]([a-z_][a-z0-9_]*)['"]/g
  const reRealtime = /\.on\(\s*['"]postgres_changes['"]\s*,\s*\{[^}]*?\btable:\s*['"]([a-z_][a-z0-9_]*)['"]/g

  for (const sub of ['api', 'composables']) {
    const dir = path.join(featureDir, sub)
    if (!fs.existsSync(dir)) continue
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith('.ts')) continue
      if (f.endsWith('.test.ts') || f.endsWith('.spec.ts')) continue
      const src = fs.readFileSync(path.join(dir, f), 'utf8')
      let m
      while ((m = reFrom.exec(src)) !== null) tables.add(m[1])
      while ((m = reRpc.exec(src)) !== null) rpc.add(m[1])
      while ((m = reRealtime.exec(src)) !== null) tables.add(m[1])
    }
  }
  return { tables, rpc }
}

function extractPagesFromFs(featureKey) {
  // Возвращает ЛИСТОВЫЕ роуты (страницы которые реально рендерятся).
  const result = new Set()
  const dir = path.join(PAGES_DIR, featureKey)
  const top = path.join(PAGES_DIR, `${featureKey}.vue`)
  const hasDir = fs.existsSync(dir) && fs.statSync(dir).isDirectory()
  const hasTop = fs.existsSync(top)
  const hasIndexInDir = hasDir && fs.existsSync(path.join(dir, 'index.vue'))

  if (hasTop && !hasDir) result.add(`/${featureKey}`)
  if (hasIndexInDir) result.add(`/${featureKey}`)

  if (hasDir) {
    for (const f of fs.readdirSync(dir)) {
      const full = path.join(dir, f)
      if (fs.statSync(full).isDirectory()) continue
      if (!f.endsWith('.vue')) continue
      const base = f.replace(/\.vue$/, '')
      if (base === 'index') continue
      result.add(`/${featureKey}/${base}`)
    }
  }
  return result
}

// ─── AGENTS.md staleness ───────────────────────────────────────────────

function extractMentionedFiles(agentsMdPath) {
  const result = new Set()
  if (!fs.existsSync(agentsMdPath)) return result
  const src = fs.readFileSync(agentsMdPath, 'utf8')
  const LOCAL_PREFIXES = ['api/', 'composables/', 'stores/', 'components/', 'utils/', '__tests__/']

  const tryAdd = (raw) => {
    const s = raw.trim()
    if (!/\.(ts|vue|md)$/.test(s)) return
    if (!LOCAL_PREFIXES.some((p) => s.startsWith(p))) return
    if (/<[^>]+>/.test(s)) return
    if (s.endsWith('/') || s.includes('*')) return
    result.add(s)
  }

  const reBacktick = /`([^`\n]+)`/g
  let m
  while ((m = reBacktick.exec(src)) !== null) tryAdd(m[1])

  const reLink = /\]\(([^)\s]+)\)/g
  while ((m = reLink.exec(src)) !== null) tryAdd(m[1])

  return result
}

function expectedAgentsMdFiles(featureDir) {
  const set = new Set()
  for (const sub of ['api', 'composables', 'stores']) {
    const dir = path.join(featureDir, sub)
    if (!fs.existsSync(dir)) continue
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith('.ts')) continue
      if (f.endsWith('.d.ts') || f.endsWith('.test.ts') || f.endsWith('.spec.ts')) continue
      if (f.startsWith('_')) continue
      set.add(`${sub}/${f}`)
    }
  }
  return set
}

// ─── Auto-fix manifest ─────────────────────────────────────────────────

function autoFixManifest(manifestPath, parsed, detected) {
  const project = makeProject()
  const src = project.addSourceFileAtPath(manifestPath)
  const exportAssign = src.getExportAssignment(() => true)
  if (!exportAssign) return false
  const expr = exportAssign.getExpression()
  if (expr.getKind() !== SyntaxKind.CallExpression) return false
  const objLit = expr.getArguments()[0]
  if (!objLit || objLit.getKind() !== SyntaxKind.ObjectLiteralExpression) return false

  const dbProp = objLit.getProperty('db')
  if (!dbProp || dbProp.getKind() !== SyntaxKind.PropertyAssignment) return false
  const dbInit = dbProp.getInitializer()
  if (!dbInit || dbInit.getKind() !== SyntaxKind.ObjectLiteralExpression) return false

  let changed = false

  const allTables = [...new Set([...detected.tables, ...parsed.tables])].sort()
  if (allTables.length) {
    const tablesArr = `[${allTables.map((t) => `'${t}'`).join(', ')}]`
    const tablesProp = dbInit.getProperty('tables')
    if (tablesProp?.getKind() === SyntaxKind.PropertyAssignment) {
      const current = tablesProp.getInitializer()?.getText() ?? ''
      if (current !== tablesArr) {
        tablesProp.setInitializer(tablesArr)
        changed = true
      }
    } else {
      dbInit.addPropertyAssignment({ name: 'tables', initializer: tablesArr })
      changed = true
    }
  }

  const allRpc = [...new Set([...detected.rpc, ...parsed.rpc])].sort()
  if (allRpc.length) {
    const rpcArr = `[${allRpc.map((r) => `'${r}'`).join(', ')}]`
    const rpcProp = dbInit.getProperty('rpc')
    if (rpcProp?.getKind() === SyntaxKind.PropertyAssignment) {
      const current = rpcProp.getInitializer()?.getText() ?? ''
      if (current !== rpcArr) {
        rpcProp.setInitializer(rpcArr)
        changed = true
      }
    } else {
      dbInit.addPropertyAssignment({ name: 'rpc', initializer: rpcArr })
      changed = true
    }
  }

  if (changed) {
    src.formatText({ indentSize: 2, convertTabsToSpaces: true })
    src.saveSync()
  }
  return changed
}

// ─── Резолверы ─────────────────────────────────────────────────────────

function routePathExists(routePath) {
  const cleaned = routePath.replace(/^\//, '')
  return [
    path.join(PAGES_DIR, `${cleaned}.vue`),
    path.join(PAGES_DIR, cleaned, 'index.vue'),
  ].some((p) => fs.existsSync(p))
}

function sharedDepExists(dep) {
  if (!dep.startsWith('shared.')) return true
  const segments = dep.split('.').slice(1)
  const candidates = []
  // Прямое отображение: dot → /
  const rel = segments.join('/')
  candidates.push(
    path.join(SHARED_DIR, `${rel}.ts`),
    path.join(SHARED_DIR, rel, 'index.ts'),
    path.join(SHARED_DIR, `${rel}.vue`),
  )
  // Fallback для файлов с точкой в имени (sf.domain.SfStepper, ui.sf.icons.SfIconTelegram):
  // склеиваем последние 2 сегмента точкой и пробуем как имя файла.
  if (segments.length >= 2) {
    const head = segments.slice(0, -2).join('/')
    const tail = segments.slice(-2).join('.')
    const merged = head ? `${head}/${tail}` : tail
    candidates.push(
      path.join(SHARED_DIR, `${merged}.ts`),
      path.join(SHARED_DIR, `${merged}.vue`),
    )
  }
  return candidates.some((p) => fs.existsSync(p))
}

function isMaterialFeature(featureDir) {
  return ['api', 'composables', 'stores'].some((sub) => fs.existsSync(path.join(featureDir, sub)))
}

// ─── Главный цикл ──────────────────────────────────────────────────────

function main() {
  if (!fs.existsSync(FEATURES_DIR)) {
    console.log('apps/storefront/features/ не существует — пропускаем')
    return
  }

  const features = (ONLY ? [ONLY] : fs.readdirSync(FEATURES_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name))

  // ── pre-pass: собираем routes из всех манифестов (для cross-feature ownership).
  // Если pages/<feature>/<sub>.vue уже декларирован в другом манифесте — не ругаемся
  // на «orphan route» в текущей фиче (например, /account/appointments принадлежит
  // appointments, а не account).
  const allManifestRoutes = new Set()
  for (const feature of features) {
    const mp = path.join(FEATURES_DIR, feature, 'feature.manifest.ts')
    if (!fs.existsSync(mp)) continue
    try {
      const p = parseManifest(mp)
      if (p) for (const r of p.routes) allManifestRoutes.add(r)
    } catch { /* parse-ошибку поймаем в основном проходе */ }
  }

  let validated = 0
  let materialWithoutDocs = 0

  for (const feature of features) {
    const dir = path.join(FEATURES_DIR, feature)
    if (!fs.existsSync(dir)) continue
    const manifestPath = path.join(dir, 'feature.manifest.ts')
    const agentsPath = path.join(dir, 'AGENTS.md')
    const material = isMaterialFeature(dir)

    const hasManifest = fs.existsSync(manifestPath)
    const hasAgents = fs.existsSync(agentsPath)

    if (material && !hasManifest) {
      recordError(feature, 'отсутствует feature.manifest.ts (фича содержит api/composables/stores). Скопируй из templates/storefront-feature/')
      materialWithoutDocs++
      continue
    }
    if (material && !hasAgents) {
      recordError(feature, 'отсутствует AGENTS.md (фича содержит api/composables/stores). Скопируй из templates/storefront-feature/')
      materialWithoutDocs++
    }
    if (!hasManifest) {
      if (!material) recordWarning(feature, 'нет feature.manifest.ts (фича пустая — это нормально, но добавь как заработает)')
      continue
    }

    let parsed
    try { parsed = parseManifest(manifestPath) }
    catch (e) { recordError(feature, `парсинг манифеста: ${e.message}`); continue }
    if (!parsed) { recordError(feature, 'не удалось извлечь defineFeature({...})'); continue }

    validated++

    // routes реально существуют
    for (const r of parsed.routes) {
      if (!routePathExists(r)) recordError(feature, `route "${r}" не имеет файла в apps/storefront/pages/`)
    }

    // dependsOn shared.* существуют
    for (const dep of parsed.dependsOn) {
      if (dep.startsWith('shared.') && !sharedDepExists(dep)) {
        recordWarning(feature, `dependsOn "${dep}" не резолвится в apps/storefront/shared/`)
      }
    }

    // AUTO-DETECT: tables/rpc из api/*
    const detected = extractTablesAndRpcFromApi(dir)
    let manifestTables = new Set(parsed.tables)
    let manifestRpc = new Set(parsed.rpc)

    if (AUTO_FIX) {
      const diff = [...detected.tables].some((t) => !manifestTables.has(t)) ||
                   [...detected.rpc].some((r) => !manifestRpc.has(r))
      if (diff && autoFixManifest(manifestPath, parsed, detected)) {
        fixed.push(`${feature}: db.tables/rpc`)
        parsed = parseManifest(manifestPath)
        manifestTables = new Set(parsed.tables)
        manifestRpc = new Set(parsed.rpc)
      }
    }

    for (const t of detected.tables) {
      if (!manifestTables.has(t)) recordWarning(feature, `db.tables не упоминает '${t}' (используется в api/). Добавь или прогони --auto-fix`)
    }
    // Таблицы из manifest.realtime[] — легитимные источники, не ругаемся что их нет в api/.
    const realtimeTablesSet = new Set(parsed.realtimeTables ?? [])
    for (const t of manifestTables) {
      if (!detected.tables.has(t) && !realtimeTablesSet.has(t)) {
        recordWarning(feature, `db.tables упоминает '${t}', но не используется в api/. Уберите или это намеренно (например, читается косвенно)?`)
      }
    }
    for (const r of detected.rpc) {
      if (!manifestRpc.has(r)) recordWarning(feature, `db.rpc не упоминает '${r}' (используется в api/)`)
    }

    // AUTO-DETECT: routes vs pages/. Если route декларирован в ДРУГОМ манифесте —
    // он уже «owned», не считаем orphan'ом текущей фичи.
    const fsRoutes = extractPagesFromFs(feature)
    const manifestRoutes = new Set(parsed.routes)
    for (const r of fsRoutes) {
      if (manifestRoutes.has(r)) continue
      if (allManifestRoutes.has(r)) continue
      recordWarning(feature, `pages/ содержит route "${r}", не упомянутый в manifest.routes`)
    }

    // AGENTS.md staleness
    if (hasAgents) {
      const mentioned = extractMentionedFiles(agentsPath)
      const expected = expectedAgentsMdFiles(dir)
      for (const file of mentioned) {
        const absolute = path.join(dir, file)
        if (!fs.existsSync(absolute)) {
          recordWarning(feature, `AGENTS.md упоминает '${file}', но файла нет (переименован/удалён?)`)
        }
      }
      for (const file of expected) {
        if (!mentioned.has(file)) {
          recordWarning(feature, `AGENTS.md не упоминает '${file}' (новый api/composable — обнови "Карту модуля")`)
        }
      }
    }
  }

  console.log(`\nПроверено манифестов storefront: ${validated}/${features.length}`)
  if (materialWithoutDocs) console.log(`Материальных фич без docs: ${materialWithoutDocs}`)
  if (fixed.length) {
    console.log(`\n✎ Автоматически обновлено (${fixed.length}):`)
    for (const f of fixed) console.log('  ' + f)
  }

  const effErrors = STRICT ? [...errors, ...warnings] : errors
  const effWarnings = STRICT ? [] : warnings

  if (effWarnings.length) {
    console.log(`\n⚠ Предупреждения (${effWarnings.length}):`)
    for (const w of effWarnings) console.log('  ' + w)
  }

  if (effErrors.length) {
    console.log(`\n✖ Ошибки (${effErrors.length}):`)
    for (const e of effErrors) console.log('  ' + e)
    process.exit(1)
  }

  console.log('\n✓ Все манифесты валидны')
}

main()
