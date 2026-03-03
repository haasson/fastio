/**
 * Скрипт создания нового тенанта в Fastio.
 *
 * Использование (локально):
 *   pnpm create-tenant
 *
 * Использование (remote):
 *   SUPABASE_URL=https://xxx.supabase.co SUPABASE_SERVICE_ROLE_KEY=... pnpm create-tenant
 *
 * Параметры:
 *   --name "Пицца Васи"
 *   --slug vasya-pizza
 *   --email owner@example.com
 *
 * Новому пользователю автоматически отправляется письмо со ссылкой для входа.
 * Если пользователь уже существует — письмо не отправляется, тенант просто создаётся.
 */

import { createClient } from '@supabase/supabase-js'
import { execSync } from 'child_process'
import { createPrivateKey, createSign } from 'crypto'

// ─── Параметры ────────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const get = (flag) => {
  const i = args.indexOf(flag)
  return i !== -1 ? args[i + 1] : null
}

const NAME  = get('--name')  ?? 'Моё заведение'
const SLUG  = get('--slug')  ?? 'my-place'
const EMAIL = get('--email') ?? 'owner@example.com'

// ─── Service role JWT ─────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321'

/**
 * Новый Supabase (GoTrue v2.180+) использует ES256 ключи из GOTRUE_JWT_KEYS
 * и отклоняет HS256. Для локальной разработки читаем приватный ключ из
 * docker-контейнера и генерируем корректный ES256 JWT.
 * Для remote передавай SUPABASE_SERVICE_ROLE_KEY через env.
 */
function getServiceRoleJwt() {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return process.env.SUPABASE_SERVICE_ROLE_KEY
  }

  try {
    const raw = execSync(
      'docker exec supabase_auth_fastio sh -c \'echo "$GOTRUE_JWT_KEYS"\'',
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] },
    ).trim()

    const keys = JSON.parse(raw)
    const ecKey = keys.find((k) => k.alg === 'ES256')
    if (!ecKey) throw new Error('ES256 ключ не найден')

    const privKey = createPrivateKey({ key: ecKey, format: 'jwk' })
    const header  = Buffer.from(JSON.stringify({ alg: 'ES256', kid: ecKey.kid, typ: 'JWT' })).toString('base64url')
    const payload = Buffer.from(JSON.stringify({
      iss:  `${SUPABASE_URL}/auth/v1`,
      role: 'service_role',
      aud:  'authenticated',
      exp:  Math.floor(Date.now() / 1000) + 86400,
    })).toString('base64url')

    const signer = createSign('SHA256')
    signer.update(`${header}.${payload}`)
    const sig = signer.sign({ key: privKey, dsaEncoding: 'ieee-p1363' }).toString('base64url')

    return `${header}.${payload}.${sig}`
  } catch {
    // Фолбэк на стандартный demo JWT (старые версии Supabase)
    return 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'
  }
}

const supabase = createClient(SUPABASE_URL, getServiceRoleJwt())

// ─── Создание ─────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🚀  Создаём тенанта: ${NAME} (${SLUG})\n`)

  // 1. Создаём / находим пользователя в Supabase Auth
  let userId

  const { data: { users }, error: listError } = await supabase.auth.admin.listUsers()
  if (listError) {
    console.error('❌  Ошибка получения пользователей:', listError.message)
    process.exit(1)
  }

  const existing = users.find((u) => u.email === EMAIL)

  if (existing) {
    userId = existing.id
    console.log(`ℹ️   Пользователь уже существует: ${EMAIL} (id: ${userId})`)
  } else {
    const { data, error } = await supabase.auth.admin.inviteUserByEmail(EMAIL, {
      redirectTo: `${process.env.APP_URL ?? 'http://localhost:4710'}/login`,
    })
    if (error) {
      console.error('❌  Ошибка приглашения пользователя:', error.message)
      process.exit(1)
    }
    userId = data.user.id
    console.log(`✅  Пользователь создан, письмо с приглашением отправлено: ${EMAIL} (id: ${userId})`)
  }

  // 2. Проверяем уникальность slug
  const { data: slugCheck } = await supabase
    .from('tenants')
    .select('id')
    .eq('slug', SLUG)
    .maybeSingle()

  if (slugCheck) {
    console.error(`❌  Slug "${SLUG}" уже занят. Выбери другой.`)
    process.exit(1)
  }

  // 3. Создаём запись тенанта
  const { data: tenant, error: tenantError } = await supabase
    .from('tenants')
    .insert({
      owner_id: userId,
      name: NAME,
      slug: SLUG,
      custom_domain: null,
      theme: {
        primaryColor: '#ff6b35',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        logoUrl: null,
        bannerUrl: null,
        preset: 'default',
      },
      contacts: {
        phone: '',
        email: EMAIL,
        address: '',
        city: '',
        instagram: null,
        vk: null,
      },
      working_hours: Object.fromEntries(
        ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((d) => [
          d, { open: '10:00', close: '22:00', closed: false },
        ])
      ),
      notifications: { email: EMAIL, telegramChatId: null },
      subscription: {
        status: 'trial',
        plan: 'basic',
        trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        renewsAt: null,
      },
      delivery_min_order: 500,
      delivery_fee: 150,
    })
    .select('id')
    .single()

  if (tenantError) {
    console.error('❌  Ошибка создания tenant:', tenantError.message)
    process.exit(1)
  }

  console.log(`✅  Tenant создан: ${tenant.id}`)

  // 4. Добавляем owner в tenant_members
  const { error: memberError } = await supabase
    .from('tenant_members')
    .insert({ tenant_id: tenant.id, user_id: userId, role: 'owner' })

  if (memberError) {
    console.error('❌  Ошибка добавления owner в tenant_members:', memberError.message)
    process.exit(1)
  }

  console.log(`✅  Owner добавлен в tenant_members`)
  console.log(`\n📋  Итого:\n`)
  console.log(`    Tenant ID  : ${tenant.id}`)
  console.log(`    Slug       : ${SLUG}`)
  console.log(`    Email      : ${EMAIL}`)
  console.log(`\n🌐  После деплоя сайт будет доступен по:`)
  console.log(`    https://${SLUG}.fastio.ru  (или настрой кастомный домен в админке)`)
  console.log(`\n📧  Владелец получит письмо со ссылкой для входа на указанный email.\n`)
}

main()
