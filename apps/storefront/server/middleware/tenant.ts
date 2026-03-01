import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

export default defineEventHandler(async (event) => {
  const host = getRequestHost(event)
  const domain = host.split(':')[0]

  // TODO: инициализация Firebase Admin через runtimeConfig
  if (!getApps().length) {
    initializeApp()
  }

  const db = getFirestore()

  // Ищем тенанта по кастомному домену или slug
  const byDomain = await db
    .collection('tenants')
    .where('customDomain', '==', domain)
    .limit(1)
    .get()

  if (!byDomain.empty) {
    event.context.tenantId = byDomain.docs[0].id
    event.context.tenant = byDomain.docs[0].data()
    return
  }

  // Fallback: поддомен вида slug.platform.com
  const slug = domain.split('.')[0]
  const bySlug = await db
    .collection('tenants')
    .where('slug', '==', slug)
    .limit(1)
    .get()

  if (!bySlug.empty) {
    event.context.tenantId = bySlug.docs[0].id
    event.context.tenant = bySlug.docs[0].data()
    return
  }

  throw createError({ statusCode: 404, message: 'Tenant not found' })
})
