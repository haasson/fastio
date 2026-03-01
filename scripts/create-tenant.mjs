/**
 * Скрипт создания нового тенанта.
 *
 * Использование:
 *   GOOGLE_APPLICATION_CREDENTIALS=./service-account.json node scripts/create-tenant.mjs
 *
 * Или с явными параметрами:
 *   node scripts/create-tenant.mjs \
 *     --name "Пицца Васи" \
 *     --slug vasya-pizza \
 *     --email owner@example.com \
 *     --password secret123
 */

import { initializeApp, cert } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'
import { resolve } from 'path'

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

// ─── Firebase init ────────────────────────────────────────────────────────────

const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS
  ?? resolve(process.cwd(), 'service-account.json')

try {
  const credential = JSON.parse(readFileSync(credPath, 'utf8'))
  initializeApp({ credential: cert(credential) })
} catch {
  console.error('❌  Не найден service-account.json')
  console.error('    Скачай его: Firebase Console → Project Settings → Service accounts → Generate new private key')
  console.error('    Положи рядом или укажи: GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json')
  process.exit(1)
}

const auth = getAuth()
const db   = getFirestore()

// ─── Создание ─────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🚀  Создаём тенанта: ${NAME} (${SLUG})\n`)

  // 1. Firebase Auth user
  let uid
  try {
    const existing = await auth.getUserByEmail(EMAIL).catch(() => null)
    if (existing) {
      uid = existing.uid
      console.log(`ℹ️   Пользователь уже существует: ${EMAIL} (uid: ${uid})`)
    } else {
      const user = await auth.createUser({ email: EMAIL, password: PASSWORD, displayName: NAME })
      uid = user.uid
      console.log(`✅  Auth пользователь создан: ${EMAIL} (uid: ${uid})`)
    }
  } catch (e) {
    console.error('❌  Ошибка создания пользователя:', e.message)
    process.exit(1)
  }

  // 2. Проверяем уникальность slug
  const slugSnap = await db.collection('tenants').where('slug', '==', SLUG).limit(1).get()
  if (!slugSnap.empty) {
    console.error(`❌  Slug "${SLUG}" уже занят. Выбери другой.`)
    process.exit(1)
  }

  // 3. Создаём tenant документ
  const tenant = {
    name: NAME,
    slug: SLUG,
    customDomain: null,
    ownerId: uid,
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
    workingHours: Object.fromEntries(
      ['mon','tue','wed','thu','fri','sat','sun'].map((d) => [
        d, { open: '10:00', close: '22:00', closed: false }
      ])
    ),
    notifications: { email: EMAIL, telegramChatId: null },
    subscription: {
      status: 'trial',
      plan: 'basic',
      trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      renewsAt: null,
    },
    deliveryMinOrder: 500,
    deliveryFee: 150,
    createdAt: new Date().toISOString(),
  }

  try {
    const ref = await db.collection('tenants').add(tenant)
    console.log(`✅  Tenant создан: ${ref.id}`)
    console.log(`\n📋  Итого:\n`)
    console.log(`    Tenant ID  : ${ref.id}`)
    console.log(`    Slug       : ${SLUG}`)
    console.log(`    Email      : ${EMAIL}`)
    console.log(`    Password   : ${PASSWORD}`)
    console.log(`    Пробный период до: ${tenant.subscription.trialEndsAt.split('T')[0]}`)
    console.log(`\n🌐  После деплоя сайт будет доступен по:`)
    console.log(`    https://${SLUG}.platform.com  (или настрой кастомный домен в админке)`)
    console.log(`\n🔐  Для входа в админку используй email и пароль выше.\n`)
  } catch (e) {
    console.error('❌  Ошибка создания tenant:', e.message)
    process.exit(1)
  }
}

main()
