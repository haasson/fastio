import { getAdminDb } from '../utils/firebase-admin'
import type { Order } from '@fastfood-saas/shared'

export default defineEventHandler(async (event) => {
  const tenantId = event.context.tenantId as string | undefined
  if (!tenantId) throw createError({ statusCode: 404 })

  const body = await readBody(event)

  // Базовая валидация
  if (!body.customer?.name || !body.customer?.phone) {
    throw createError({ statusCode: 400, message: 'Имя и телефон обязательны' })
  }
  if (!body.items?.length) {
    throw createError({ statusCode: 400, message: 'Корзина пуста' })
  }

  const db = getAdminDb()

  const order: Omit<Order, 'id'> = {
    tenantId,
    customer: body.customer,
    items: body.items,
    deliveryType: body.deliveryType,
    address: body.address ?? null,
    comment: body.comment ?? null,
    promoCode: body.promoCode ?? null,
    discountAmount: body.discountAmount ?? 0,
    subtotal: body.subtotal,
    deliveryFee: body.deliveryFee ?? 0,
    total: body.total,
    status: 'new',
    paymentType: body.paymentType ?? 'cash',
    createdAt: new Date().toISOString(),
  }

  const ref = await db
    .collection('tenants')
    .doc(tenantId)
    .collection('orders')
    .add(order)

  return { id: ref.id }
})
