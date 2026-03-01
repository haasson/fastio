import { getAdminDb } from '../utils/firebase-admin'
import type { Category, Dish } from '@fastfood-saas/shared'

export default defineEventHandler(async (event) => {
  const tenantId = event.context.tenantId as string | undefined
  if (!tenantId) throw createError({ statusCode: 404 })

  const db = getAdminDb()
  const tenantRef = db.collection('tenants').doc(tenantId)

  const [categoriesSnap, dishesSnap] = await Promise.all([
    tenantRef.collection('categories').where('active', '==', true).orderBy('order').get(),
    tenantRef.collection('dishes').where('active', '==', true).orderBy('order').get(),
  ])

  return {
    categories: categoriesSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Category),
    dishes: dishesSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Dish),
  }
})
