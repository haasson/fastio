#!/usr/bin/env node
/*
 * Проверяет дрейф между схемой локальной БД и закоммиченным
 * `apps/admin/shared/data/database.types.ts`.
 *
 * Запускается в CI после применения миграций. Если генерация даст diff
 * с закоммиченным файлом — exit 1 с указанием запустить `pnpm db:gen-types`.
 *
 * Локально перед коммитом миграции:
 *   pnpm db:gen-types && git add apps/admin/shared/data/database.types.ts
 */
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.resolve(__dirname, '..', '..')
const TARGET = path.join(ROOT, 'apps', 'admin', 'shared', 'data', 'database.types.ts')

function fail(msg) {
  console.error(`\n[db:gen-types:check] ${msg}\n`)
  process.exit(1)
}

if (!fs.existsSync(TARGET)) {
  fail(`Файл ${TARGET} не найден. Запусти \`pnpm db:gen-types\` и закоммить результат.`)
}

let generated = ''

try {
  generated = execSync('pnpm dlx supabase gen types typescript --local --schema public', {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
} catch (err) {
  fail(`Не удалось сгенерить типы (БД запущена? \`pnpm supabase:start\`).\n${err.message}`)
}

const committed = fs.readFileSync(TARGET, 'utf8')

if (generated.trim() !== committed.trim()) {
  fail([
    'Схема БД отличается от `apps/admin/shared/data/database.types.ts`.',
    'Применил миграцию и забыл регенерить типы?',
    '',
    '  pnpm db:gen-types',
    '  git add apps/admin/shared/data/database.types.ts',
  ].join('\n'))
}

console.log('[db:gen-types:check] OK — типы синхронизированы со схемой БД')
