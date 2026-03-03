/**
 * Извлекает ES256 приватный ключ из Docker-контейнера supabase_auth_fastio
 * и дописывает NUXT_SUPABASE_JWT_PRIVATE_KEY в apps/backoffice/.env
 *
 * Использование:
 *   pnpm backoffice:setup
 */

import { execSync } from 'child_process'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const ENV_PATH = resolve(__dirname, '../apps/backoffice/.env')

function extractJwkKey() {
  const raw = execSync(
    'docker exec supabase_auth_fastio sh -c \'echo "$GOTRUE_JWT_KEYS"\'',
    { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
  ).trim()

  const keys = JSON.parse(raw)
  const ecKey = keys.find((k) => k.alg === 'ES256')
  if (!ecKey) throw new Error('ES256 ключ не найден в GOTRUE_JWT_KEYS')

  return Buffer.from(JSON.stringify(ecKey)).toString('base64')
}

function updateEnvFile(jwkJson) {
  const KEY = 'NUXT_SUPABASE_JWT_PRIVATE_KEY'
  const newLine = `${KEY}=${jwkJson}`

  if (existsSync(ENV_PATH)) {
    let content = readFileSync(ENV_PATH, 'utf8')

    if (content.includes(KEY + '=')) {
      content = content.replace(new RegExp(`^${KEY}=.*$`, 'm'), newLine)
      writeFileSync(ENV_PATH, content, 'utf8')
      console.log(`✅  Обновлено ${KEY} в ${ENV_PATH}`)
    } else {
      writeFileSync(ENV_PATH, content.trimEnd() + '\n' + newLine + '\n', 'utf8')
      console.log(`✅  Добавлено ${KEY} в ${ENV_PATH}`)
    }
  } else {
    writeFileSync(ENV_PATH, newLine + '\n', 'utf8')
    console.log(`✅  Создан ${ENV_PATH} с ${KEY}`)
  }
}

try {
  console.log('\n🔑  Извлекаем ES256 ключ из Docker...\n')
  const jwk = extractJwkKey()
  updateEnvFile(jwk)
  console.log('\n✔   Готово! Перезапусти dev-сервер:\n    pnpm dev:backoffice\n')
} catch (err) {
  console.error('\n❌  Ошибка:', err.message)
  console.error('\n    Убедись что Supabase запущен: pnpm supabase:start\n')
  process.exit(1)
}
