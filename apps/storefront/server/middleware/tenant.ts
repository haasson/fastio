import { getAdminDb } from '../utils/firebase-admin'

export default defineEventHandler(async (event) => {
  // Пропускаем служебные запросы Nuxt
  const url = getRequestURL(event)
  if (url.pathname.startsWith('/_nuxt') || url.pathname.startsWith('/__nuxt')) return

  const host = getRequestHost(event)
  const domain = host.split(':')[0]

  const db = getAdminDb()

  const byDomain = await db
    .collection('tenants')
    .where('customDomain', '==', domain)
    .limit(1)
    .get()

  if (!byDomain.empty) {
    event.context.tenantId = byDomain.docs[0].id
    event.context.tenant = { id: byDomain.docs[0].id, ...byDomain.docs[0].data() }
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
    event.context.tenant = { id: bySlug.docs[0].id, ...bySlug.docs[0].data() }
    return
  }

  throw createError({ statusCode: 404, message: 'Tenant not found' })
})
