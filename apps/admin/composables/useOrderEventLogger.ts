import type { Order, OrderStatus } from '@fastio/shared'
import { useAuthStore } from '~/stores/auth'
import { useTenantStore } from '~/stores/tenant'
import { useSupabaseApi } from '~/composables/useSupabaseApi'

type OrderForm = {
  status: string
  customerName: string
  customerPhone: string
  deliveryType: Order['deliveryType']
  address: string
  items: Order['items']
  deliveryFee: number
  paymentType: Order['paymentType']
}

type FieldMapping = {
  field: string
  formVal: (f: OrderForm) => unknown
  orderVal: (o: Order) => unknown
}

const FIELD_MAPPINGS: FieldMapping[] = [
  { field: 'customer_name', formVal: (f) => f.customerName, orderVal: (o) => o.customer.name },
  { field: 'customer_phone', formVal: (f) => f.customerPhone, orderVal: (o) => o.customer.phone },
  { field: 'address', formVal: (f) => f.address || null, orderVal: (o) => o.address },
  { field: 'payment_type', formVal: (f) => f.paymentType, orderVal: (o) => o.paymentType },
  { field: 'delivery_fee', formVal: (f) => f.deliveryFee, orderVal: (o) => o.deliveryFee },
  { field: 'delivery_type', formVal: (f) => f.deliveryType, orderVal: (o) => o.deliveryType },
]

export const useOrderEventLogger = () => {
  const api = useSupabaseApi()
  const authStore = useAuthStore()
  const tenantStore = useTenantStore()

  const logSaveEvents = (form: OrderForm, order: Order, statuses: OrderStatus[]) => {
    if (!authStore.user) return

    const actor = {
      orderId: order.id,
      tenantId: order.tenantId,
      actorId: authStore.user.id,
      actorName: authStore.user.email ?? null,
      actorRole: tenantStore.currentRole ?? null,
    }

    if (form.status !== order.status) {
      const oldStatus = statuses.find((s) => s.id === order.status)
      const newStatus = statuses.find((s) => s.id === form.status)

      api.orderEvents.add({
        ...actor,
        eventType: 'status_changed',
        meta: {
          from_id: order.status,
          from_name: oldStatus?.name ?? null,
          to_id: form.status,
          to_name: newStatus?.name ?? null,
        },
      })
    }

    const fieldChanges = FIELD_MAPPINGS
      .filter((m) => m.formVal(form) !== m.orderVal(order))
      .map((m) => ({ field: m.field, old_value: m.orderVal(order), new_value: m.formVal(form) }))

    if (fieldChanges.length > 0) {
      api.orderEvents.add({ ...actor, eventType: 'field_updated', meta: { changes: fieldChanges } })
    }

    if (JSON.stringify(form.items) !== JSON.stringify(order.items)) {
      api.orderEvents.add({ ...actor, eventType: 'items_updated', meta: { before: order.items, after: form.items } })
    }
  }

  return { logSaveEvents }
}
