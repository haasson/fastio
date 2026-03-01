import type { Tenant } from '@fastfood-saas/shared'

export default defineEventHandler((event) => {
  const tenant = event.context.tenant as Tenant | undefined
  if (!tenant) throw createError({ statusCode: 404, message: 'Tenant not found' })
  return tenant
})
