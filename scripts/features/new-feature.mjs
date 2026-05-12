#!/usr/bin/env node
// Инициализатор новой фичи из templates/feature-crud/.
//
// Usage:
//   pnpm new:feature bookings --singular=booking --vertical=retail --purpose="Бронирования столов"
//   pnpm new:feature bookings    # спросит недостающее интерактивно (если TTY)
//
// Что делает:
//   1. Проверяет что apps/admin/features/<name>/ не существует
//   2. Копирует templates/feature-crud/__feature__/ → apps/admin/features/<name>/
//   3. Переименовывает файлы с __feature__ в singular camelCase / PascalCase
//   4. Делает replace плейсхолдеров в содержимом
//   5. Печатает TODO-список (что доделать руками: permissions, routes, миграция БД)

import fs from 'node:fs'
import path from 'node:path'
import url from 'node:url'
import readline from 'node:readline/promises'

const __dirname = path.dirname(url.fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '../..')
const TEMPLATE_DIR = path.join(ROOT, 'templates/feature-crud/__feature__')
const FEATURES_DIR = path.join(ROOT, 'apps/admin/features')

const args = process.argv.slice(2)
const getFlag = (name) => {
  const arg = args.find((a) => a.startsWith(`--${name}=`))
  return arg ? arg.split('=').slice(1).join('=') : null
}

const featureKey = args.find((a) => !a.startsWith('--')) // first positional

if (!featureKey) {
  console.error('Usage: pnpm new:feature <kebab-case-name> [--singular=<singular>] [--vertical=retail|services|shared] [--purpose="..."]')
  process.exit(1)
}

if (!/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(featureKey)) {
  console.error(`Имя фичи должно быть в kebab-case (lowercase, дефисы). Получено: "${featureKey}"`)
  process.exit(1)
}

const targetDir = path.join(FEATURES_DIR, featureKey)
if (fs.existsSync(targetDir)) {
  console.error(`Фича уже существует: ${targetDir}`)
  process.exit(1)
}

let singular = getFlag('singular')
let vertical = getFlag('vertical')
let purpose = getFlag('purpose')

// ─── Интерактив ───
async function prompt(question, fallback) {
  if (!process.stdin.isTTY) return fallback
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  const ans = (await rl.question(question)).trim()
  rl.close()
  return ans || fallback
}

// Угадываем singular для kebab-case ключа.
// - bookings → booking
// - categories → category
// - news / status / address / lens → как есть (двух-/одно-сложные на -s, -ss, -us, -is)
// - bus / class / boss → как есть (-s в конце двусогласного / двойного -ss)
// Это эвристика для prompt-дефолта; всё равно даём юзеру переопределить.
const guessSingular = (key) => {
  if (key.length <= 3) return key
  if (/(ss|us|is|ous)$/.test(key)) return key
  if (key.endsWith('ies') && key.length > 4) return key.slice(0, -3) + 'y'
  if (key.endsWith('s')) return key.slice(0, -1)
  return key
}

const main = async () => {
  if (!singular) {
    const guess = guessSingular(featureKey)
    singular = await prompt(`Singular (одиночное имя сущности, для типа) [${guess}]: `, guess)
  }
  if (!vertical) {
    vertical = await prompt('Vertical (retail/services/shared) [shared]: ', 'shared')
  }
  if (!['retail', 'services', 'shared'].includes(vertical)) {
    console.error(`vertical должен быть retail/services/shared, получено: ${vertical}`)
    process.exit(1)
  }
  if (!purpose) {
    purpose = await prompt('Purpose (одно предложение что делает): ', 'TODO: опиши назначение')
  }

  const kebabToCamel = (s) => s.replace(/-([a-z])/g, (_, c) => c.toUpperCase())
  const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1)
  const kebabToPascal = (s) => capitalize(kebabToCamel(s))
  const kebabToSnake = (s) => s.replace(/-/g, '_')

  const replacements = {
    __FEATURE_KEY__: featureKey,                          // bookings
    __FEATURE_CAMEL__: kebabToCamel(singular),            // booking
    __FEATURE_PASCAL__: kebabToPascal(singular),          // Booking
    __TABLE__: kebabToSnake(featureKey),                  // bookings
    __VERTICAL__: vertical,                                // retail
    __PURPOSE__: purpose,                                  // "Бронирования столов"
    // Плейсхолдеры в именах файлов:
    __Feature__: kebabToPascal(singular),                 // Booking — для useBooking.ts
    __feature__: kebabToCamel(singular),                  // booking — для booking.ts, store
  }

  // Рекурсивно копируем templates/feature-crud/__feature__ → apps/admin/features/<featureKey>
  // с заменой содержимого + переименованием файлов где встречается __feature__
  function renameInPath(name) {
    // Применяем все file-name placeholders. __Feature__ ДО __feature__ (substring overlap).
    return name
      .replace(/__Feature__/g, replacements.__Feature__)
      .replace(/__feature__/g, replacements.__feature__)
  }

  function copyDir(src, dst) {
    fs.mkdirSync(dst, { recursive: true })
    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
      const srcPath = path.join(src, entry.name)
      const dstName = renameInPath(entry.name)
      const dstPath = path.join(dst, dstName)
      if (entry.isDirectory()) {
        copyDir(srcPath, dstPath)
      } else if (entry.name === '.gitkeep') {
        fs.writeFileSync(dstPath, '')
      } else {
        let content = fs.readFileSync(srcPath, 'utf8')
        for (const [from, to] of Object.entries(replacements)) {
          content = content.split(from).join(to)
        }
        fs.writeFileSync(dstPath, content)
      }
    }
  }

  copyDir(TEMPLATE_DIR, targetDir)

  console.log(`\n✓ Создана фича: ${path.relative(ROOT, targetDir)}\n`)
  console.log('Что доделать руками:')
  console.log(`  1. Заполни TODO в feature.manifest.ts (permissions, routes, dependsOn)`)
  console.log(`  2. Заполни TODO в AGENTS.md (карта файлов, типовые задачи)`)
  console.log(`  3. Создай миграцию для таблицы '${replacements.__TABLE__}' в supabase/migrations/`)
  console.log(`  4. Добавь страницу/страницы в apps/admin/pages/${featureKey}/`)
  console.log(`  5. Если фича toggleable — добавь '${featureKey}' (или подходящий ключ) в TenantModules`)
  console.log(`     (packages/shared/src/types/tenant.ts) и в apps/admin/config/modules.ts`)
  console.log(`  6. Подключи API в apps/admin/shared/data/useDatabase.ts`)
  console.log(`     чтобы был доступен как useDatabase().${replacements.__FEATURE_CAMEL__}s`)
  console.log(`  7. Если есть новые permissions — добавь в apps/admin/config/team-roles.ts`)
  console.log(`  8. Прогони: pnpm features:validate && pnpm typecheck\n`)
}

main().catch((e) => { console.error(e); process.exit(1) })
