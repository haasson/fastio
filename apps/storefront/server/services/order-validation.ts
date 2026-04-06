import type { SupabaseClient } from '@supabase/supabase-js'

const VALID_DELIVERY_TYPES = ['delivery', 'pickup', 'dine_in', 'request'] as const
const VALID_PAYMENT_TYPES = ['cash', 'card', 'online'] as const

export type DeliveryType = typeof VALID_DELIVERY_TYPES[number]
export type PaymentType = typeof VALID_PAYMENT_TYPES[number]

export type TenantOrderConfig = {
  deliveryFee: number
  deliveryMinOrder: number
  modules: Record<string, boolean> | null
}

export type OrderInitialData = {
  tenantConfig: TenantOrderConfig
  initialStatusId: string
}

export function validateBasicFields(body: Record<string, unknown>): {
  deliveryType: DeliveryType
  paymentType: PaymentType
} {
  if (body.deliveryType !== 'dine_in' && !(body.customer as Record<string, unknown>)?.phone) {
    throw createError({ statusCode: 400, message: 'Телефон обязателен' })
  }
  if (!Array.isArray(body.items) || body.items.length === 0) {
    throw createError({ statusCode: 400, message: 'Корзина пуста' })
  }

  const deliveryType = body.deliveryType as string
  if (!VALID_DELIVERY_TYPES.includes(deliveryType as DeliveryType)) {
    throw createError({ statusCode: 400, message: 'Некорректный тип доставки' })
  }

  const paymentType = (body.paymentType ?? 'cash') as string
  if (!VALID_PAYMENT_TYPES.includes(paymentType as PaymentType)) {
    throw createError({ statusCode: 400, message: 'Некорректный тип оплаты' })
  }

  return {
    deliveryType: deliveryType as DeliveryType,
    paymentType: paymentType as PaymentType,
  }
}

export async function fetchOrderInitialData(
  supabase: SupabaseClient,
  tenantId: string,
): Promise<OrderInitialData> {
  const [{ data: tenantData, error: tenantError }, { data: initialStatusData }] = await Promise.all([
    supabase.from('tenants').select('delivery_fee, delivery_min_order, modules').eq('id', tenantId).single(),
    supabase.from('order_statuses').select('id').eq('tenant_id', tenantId).eq('group_type', 'new').order('position').limit(1).single(),
  ])

  if (tenantError || !tenantData) {
    throw createError({ statusCode: 500, message: 'Не удалось получить данные ресторана' })
  }

  return {
    tenantConfig: {
      deliveryFee: Number(tenantData.delivery_fee),
      deliveryMinOrder: Number(tenantData.delivery_min_order),
      modules: tenantData.modules as Record<string, boolean> | null,
    },
    initialStatusId: initialStatusData!.id as string,
  }
}

export function validateModulesForDeliveryType(
  deliveryType: DeliveryType,
  modules: Record<string, boolean> | null,
): void {
  if (deliveryType === 'delivery' && !modules?.delivery) {
    throw createError({ statusCode: 400, message: 'Доставка отключена' })
  }
  if (deliveryType === 'pickup' && !modules?.pickup) {
    throw createError({ statusCode: 400, message: 'Самовывоз отключён' })
  }
  if (deliveryType === 'dine_in' && !modules?.dineIn) {
    throw createError({ statusCode: 400, message: 'Заказ со стола недоступен' })
  }
  if (deliveryType === 'request' && modules?.delivery) {
    throw createError({ statusCode: 400, message: 'Используйте обычный заказ для этого заведения' })
  }
}
