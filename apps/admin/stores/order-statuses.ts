import { defineStore } from 'pinia'
import { storeToRefs } from 'pinia'
import { useOrderStatuses } from '~/composables/data/useOrderStatuses'
import { useTenantStore } from './tenant'

// Статусы заказов нужны во многих компонентах (OrderCard, OrderRow, OrderEditModal и др.),
// поэтому держим их в сторе, чтобы не пробрасывать пропами.
// Вся логика работы с API и realtime живёт в useOrderStatuses —
// стор только связывает её с текущим тенантом и делает глобальной.
export const useOrderStatusesStore = defineStore('orderStatuses', () => {
  const { tenantId } = storeToRefs(useTenantStore())

  return useOrderStatuses(tenantId)
})
