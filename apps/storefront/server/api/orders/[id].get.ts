import { getAdminDb } from '../../utils/firebase-admin'
import type { Order } from '@fastfood-saas/shared'

export default defineEventHandler(async (event) => {
  const tenantId = event.context.tenantId as string | undefined
  if (!tenantId) throw createError({ statusCode: 404 })

  const id = getRouterParam(event, 'id')!
  const db = getAdminDb()

  const snap = await db
    .collection('tenants')
    .doc(tenantId)
    .collection('orders')
    .doc(id)
    .get()

  if (!snap.exists) throw createError({ statusCode: 404, message: 'Заказ не найден' })

  return { id: snap.id, ...snap.data() } as Order
})
