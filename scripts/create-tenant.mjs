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
 *   --password secret123
 */

import { createClient } from '@supabase/supabase-js'

// ─── Параметры ────────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const get = (flag) => {
  const i = args.indexOf(flag)
  return i !== -1 ? args[i + 1] : null
}

const NAME     = get('--name')     ?? 'Моё заведение'
const SLUG     = get('--slug')     ?? 'my-place'
const EMAIL    = get('--email')    ?? 'owner@example.com'
const PASSWORD = get('--password') ?? 'changeme123'

// ─── Supabase init ────────────────────────────────────────────────────────────

const SUPABASE_URL             = process.env.SUPABASE_URL             ?? 'http://127.0.0.1:54321'
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz'

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

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
    const { data, error } = await supabase.auth.admin.createUser({
      email: EMAIL,
      password: PASSWORD,
      email_confirm: true,
    })
    if (error) {
      console.error('❌  Ошибка создания пользователя:', error.message)
      process.exit(1)
    }
    userId = data.user.id
    console.log(`✅  Пользователь создан: ${EMAIL} (id: ${userId})`)
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
  console.log(`\n📋  Итого:\n`)
  console.log(`    Tenant ID  : ${tenant.id}`)
  console.log(`    Slug       : ${SLUG}`)
  console.log(`    Email      : ${EMAIL}`)
  console.log(`    Password   : ${PASSWORD}`)
  console.log(`\n🌐  После деплоя сайт будет доступен по:`)
  console.log(`    https://${SLUG}.fastio.ru  (или настрой кастомный домен в админке)`)
  console.log(`\n🔐  Для входа в админку используй email и пароль выше.\n`)
}

main()
