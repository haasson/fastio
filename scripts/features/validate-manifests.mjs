#!/usr/bin/env node
// Валидатор feature.manifest.ts + AGENTS.md.
//
// Что проверяет:
//   ERRORS (блокируют коммит):
//     • Фича содержит api/composables/stores → обязаны быть feature.manifest.ts И AGENTS.md
//     • tenantModule:true → key ∈ TenantModules
//     • permissions[] → каждый объявлен в config/team-roles.ts
//     • routes[].path → файл реально существует в apps/admin/pages/
//
//   WARNINGS (печатаются, не блокируют):
//     • Auto-detect рассинхрона:
//         - .from('x') / .rpc('y') в api/* не в manifest.db.tables / manifest.db.rpc
//         - manifest.db.tables упоминает таблицу, не используемую в api/*
//         - pages/<feature>/*.vue не упомянут в manifest.routes
//         - manifest.routes упоминает несуществующую страницу (это error выше)
//     • AGENTS.md staleness:
//         - Файл упомянут в "Карте модуля", но не существует
//         - Существует api/*.ts или composables/*.ts, не упомянутый в "Карте модуля"
//     • dependsOn shared.<x> → файл не найден
//
// Flags:
//   --strict           Превращает все warnings в errors (для CI)
//   --auto-fix         Автообновляет авто-генерируемые поля manifest (db.tables, db.rpc, routes paths).
//                      Не трогает purpose, permissions, dependsOn, AGENTS.md.
//   --feature=<name>   Прогон только по одной фиче
//
// Usage: node scripts/features/validate-manifests.mjs

import fs from 'node:fs'
import path from 'node:path'
import url from 'node:url'
import { Project, SyntaxKind } from 'ts-morph'

const __dirname = path.dirname(url.fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '../..')
const FEATURES_DIR = path.join(ROOT, 'apps/admin/features')
const PAGES_DIR = path.join(ROOT, 'apps/admin/pages')
const SHARED_DIR = path.join(ROOT, 'apps/admin/shared')
const ROLES_FILE = path.join(ROOT, 'apps/admin/config/team-roles.ts')
const TENANT_TYPES_FILE = path.join(ROOT, 'packages/shared/src/types/tenant.ts')

const args = process.argv.slice(2)
const STRICT = args.includes('--strict')
const AUTO_FIX = args.includes('--auto-fix')
const ONLY = args.find((a) => a.startsWith('--feature='))?.split('=')[1]

const errors = []
const warnings = []
const fixed = []

const recordError = (feature, msg) => errors.push(`[${feature}] ${msg}`)
const recordWarning = (feature, msg) => warnings.push(`[${feature}] ${msg}`)

// ─── Эталоны ────────────────────────────────────────────────────────────

function collectKnownPermissions() {
  const src = fs.readFileSync(ROLES_FILE, 'utf8')
  const set = new Set()
  const re = /key:\s*'([^']+)'/g
  let m
  while ((m = re.exec(src)) !== null) set.add(m[1])
  return set
}

function collectKnownModuleKeys() {
  const src = fs.readFileSync(TENANT_TYPES_FILE, 'utf8')
  const blockMatch = src.match(/export\s+type\s+TenantModules\s*=\s*\{([\s\S]*?)\}/)
  if (!blockMatch) return new Set()
  const body = blockMatch[1]
  const set = new Set()
  const re = /^\s*(\w+):\s*boolean/gm
  let m
  while ((m = re.exec(body)) !== null) set.add(m[1])
  return set
}

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
const readBoolLiteral = (n) => {
  if (!n) return null
  if (n.getKind() === SyntaxKind.TrueKeyword) return true
  if (n.getKind() === SyntaxKind.FalseKeyword) return false
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
  const tenantModule = readBoolLiteral(getProp(objLit, 'tenantModule'))
  const permissions = readArrayOfStrings(getProp(objLit, 'permissions')) ?? []
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

  return { key, tenantModule, permissions, dependsOn, routes, tables, rpc }
}

// ─── Auto-detect инфры из кода ──────────────────────────────────────────

function extractTablesAndRpcFromApi(featureDir) {
  const apiDir = path.join(featureDir, 'api')
  if (!fs.existsSync(apiDir)) return { tables: new Set(), rpc: new Set() }
  const tables = new Set()
  const rpc = new Set()
  for (const f of fs.readdirSync(apiDir)) {
    if (!f.endsWith('.ts')) continue
    if (f.endsWith('.test.ts') || f.endsWith('.spec.ts')) continue
    const src = fs.readFileSync(path.join(apiDir, f), 'utf8')
    let m
    const reFrom = /\.from\(\s*['"]([a-z_][a-z0-9_]*)['"]/g
    while ((m = reFrom.exec(src)) !== null) tables.add(m[1])
    const reRpc = /\.rpc\(\s*['"]([a-z_][a-z0-9_]*)['"]/g
    while ((m = reRpc.exec(src)) !== null) rpc.add(m[1])
  }
  return { tables, rpc }
}

function extractPagesFromFs(featureKey) {
  // Возвращает ЛИСТОВЫЕ роуты (страницы которые реально рендерятся).
  // Top-level `pages/<feature>.vue` БЕЗ pages/<feature>/index.vue считается layout-родителем
  // для nested routes (Nuxt nested routing pattern) и не отдельным route.
  const result = new Set()
  const dir = path.join(PAGES_DIR, featureKey)
  const top = path.join(PAGES_DIR, `${featureKey}.vue`)
  const hasDir = fs.existsSync(dir) && fs.statSync(dir).isDirectory()
  const hasTop = fs.existsSync(top)
  const hasIndexInDir = hasDir && fs.existsSync(path.join(dir, 'index.vue'))

  // Top-level page без nested dir → отдельный route /<feature>
  if (hasTop && !hasDir) result.add(`/${featureKey}`)
  // index.vue в директории → route /<feature>
  if (hasIndexInDir) result.add(`/${featureKey}`)

  if (hasDir) {
    for (const f of fs.readdirSync(dir)) {
      const full = path.join(dir, f)
      if (fs.statSync(full).isDirectory()) continue
      if (!f.endsWith('.vue')) continue
      const base = f.replace(/\.vue$/, '')
      if (base === 'index') continue // обработан выше
      result.add(`/${featureKey}/${base}`)
    }
  }
  return result
}

// ─── AGENTS.md staleness ───────────────────────────────────────────────

function extractMentionedFiles(agentsMdPath) {
  // Возвращаем только ЛОКАЛЬНЫЕ файлы фичи: api/*, composables/*, stores/*, components/*, utils/*, columns/*, config/*.
  // Файлы из shared/, packages/, apps/, server/ — это cross-refs, валидатору их не проверять.
  // Подхватываем 2 формата: бэктики `path` и markdown-ссылки [text](path).
  const result = new Set()
  if (!fs.existsSync(agentsMdPath)) return result
  const src = fs.readFileSync(agentsMdPath, 'utf8')
  // config/ намеренно НЕ в списке — cross-refs на apps/admin/config/* частые (например, config/modules.ts).
  // У фичи редко есть собственный config/ (исключение — onboarding), поэтому false positives дороже.
  const LOCAL_PREFIXES = ['api/', 'composables/', 'stores/', 'components/', 'utils/', 'columns/', '__tests__/']

  const tryAdd = (raw) => {
    const s = raw.trim()
    if (!/\.(ts|vue|md)$/.test(s)) return
    if (!LOCAL_PREFIXES.some((p) => s.startsWith(p))) return
    // Пропускаем placeholder'ы: "api/<name>.ts", "components/<X>.vue" из "Типовых задач"
    if (/<[^>]+>/.test(s)) return
    // Пропускаем глоб-выражения: "components/timeline/", "tours/*"
    if (s.endsWith('/') || s.includes('*')) return
    result.add(s)
  }

  // 1) Бэктики: `api/foo.ts`
  const reBacktick = /`([^`\n]+)`/g
  let m
  while ((m = reBacktick.exec(src)) !== null) tryAdd(m[1])

  // 2) Markdown-ссылки: [text](path)
  const reLink = /\]\(([^)\s]+)\)/g
  while ((m = reLink.exec(src)) !== null) tryAdd(m[1])

  return result
}

function expectedAgentsMdFiles(featureDir) {
  // Файлы которые ДОЛЖНЫ быть упомянуты в AGENTS.md: api/*.ts, composables/*.ts, stores/*.ts
  // (components/utils/columns не обязательны — там могут быть много мелких)
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

// Через ts-morph: безопасная мутация AST без regex-хака.
// Обновляет db.tables и db.rpc (создаёт rpc-проп если его не было).
// НЕ удаляет существующие записи и не трогает permissions/purpose/dependsOn/routes.
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

  // ─ tables ─
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

  // ─ rpc ─ (создаём проп если его не было)
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
  // Dynamic route: /reservations/[id] → pages/reservations/[id].vue
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
  // Fallback для файлов с точкой в имени (useGate.services.ts, useGate.types.ts):
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
  // Фича считается «материальной» если содержит api/, composables/ или stores/
  return ['api', 'composables', 'stores'].some((sub) => fs.existsSync(path.join(featureDir, sub)))
}

// ─── Главный цикл ──────────────────────────────────────────────────────

function main() {
  const knownPerms = collectKnownPermissions()
  const knownModuleKeys = collectKnownModuleKeys()

  const features = (ONLY ? [ONLY] : fs.readdirSync(FEATURES_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name))

  let validated = 0
  let materialWithoutDocs = 0

  for (const feature of features) {
    const dir = path.join(FEATURES_DIR, feature)
    if (!fs.existsSync(dir)) continue
    const manifestPath = path.join(dir, 'feature.manifest.ts')
    const agentsPath = path.join(dir, 'AGENTS.md')
    const material = isMaterialFeature(dir)

    // 1. Manifest + AGENTS.md обязательны если фича материальная
    const hasManifest = fs.existsSync(manifestPath)
    const hasAgents = fs.existsSync(agentsPath)

    if (material && !hasManifest) {
      recordError(feature, 'отсутствует feature.manifest.ts (фича содержит api/composables/stores). Скопируй из templates/feature-crud/')
      materialWithoutDocs++
      continue
    }
    if (material && !hasAgents) {
      recordError(feature, 'отсутствует AGENTS.md (фича содержит api/composables/stores). Скопируй из templates/feature-crud/')
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

    // 2. tenantModule consistency
    if (parsed.tenantModule === true && !knownModuleKeys.has(parsed.key)) {
      recordError(feature, `tenantModule:true, но key="${parsed.key}" не в TenantModules. Допустимые: ${[...knownModuleKeys].join(', ')}`)
    }

    // 3. permissions ⊆ team-roles
    for (const perm of parsed.permissions) {
      if (!knownPerms.has(perm)) recordError(feature, `permission "${perm}" не объявлен в config/team-roles.ts`)
    }

    // 3a. Пустые permissions — warning, если в манифесте нет sentinel-комментария.
    // Это отличает «забыли заполнить» от «осознанно пустое» (auth/help/legal — фичи без RBAC).
    if (parsed.permissions.length === 0) {
      const src = fs.readFileSync(manifestPath, 'utf8')
      const hasSentinel = /\/\/\s*permissions:\s*intentionally\s*empty/i.test(src)
      if (!hasSentinel) {
        recordWarning(feature, 'permissions:[] без объяснения. Добавь комментарий "// permissions: intentionally empty — <причина>" над массивом, либо заполни.')
      }
    }

    // 4. routes реально существуют
    for (const r of parsed.routes) {
      if (!routePathExists(r)) recordError(feature, `route "${r}" не имеет файла в apps/admin/pages/`)
    }

    // 5. dependsOn shared.* существуют
    for (const dep of parsed.dependsOn) {
      if (dep.startsWith('shared.') && !sharedDepExists(dep)) {
        recordWarning(feature, `dependsOn "${dep}" не резолвится в apps/admin/shared/`)
      }
    }

    // 6. AUTO-DETECT: tables/rpc из api/*
    const detected = extractTablesAndRpcFromApi(dir)
    let manifestTables = new Set(parsed.tables)
    let manifestRpc = new Set(parsed.rpc)

    // Try auto-fix первым делом
    if (AUTO_FIX) {
      const diff = [...detected.tables].some((t) => !manifestTables.has(t)) ||
                   [...detected.rpc].some((r) => !manifestRpc.has(r))
      if (diff && autoFixManifest(manifestPath, parsed, detected)) {
        fixed.push(`${feature}: db.tables/rpc`)
        // re-parse после фикса и обновляем локальные множества, чтобы дальнейшие проверки видели актуальное состояние
        parsed = parseManifest(manifestPath)
        manifestTables = new Set(parsed.tables)
        manifestRpc = new Set(parsed.rpc)
      }
    }

    for (const t of detected.tables) {
      if (!manifestTables.has(t)) recordWarning(feature, `db.tables не упоминает '${t}' (используется в api/). Добавь или прогони --auto-fix`)
    }
    for (const t of manifestTables) {
      if (!detected.tables.has(t)) recordWarning(feature, `db.tables упоминает '${t}', но не используется в api/. Уберите или это намеренно (например, читается косвенно)?`)
    }
    for (const r of detected.rpc) {
      if (!manifestRpc.has(r)) recordWarning(feature, `db.rpc не упоминает '${r}' (используется в api/)`)
    }

    // 7. AUTO-DETECT: routes vs pages/
    const fsRoutes = extractPagesFromFs(feature)
    const manifestRoutes = new Set(parsed.routes)
    for (const r of fsRoutes) {
      if (!manifestRoutes.has(r)) recordWarning(feature, `pages/ содержит route "${r}", не упомянутый в manifest.routes`)
    }

    // 8. AGENTS.md staleness
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

  // ─── Итог ────────────────────────────────────────────────────────────
  console.log(`\nПроверено манифестов: ${validated}/${features.length}`)
  console.log(`Известных permissions: ${knownPerms.size}, ModuleKey: ${knownModuleKeys.size}`)
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
