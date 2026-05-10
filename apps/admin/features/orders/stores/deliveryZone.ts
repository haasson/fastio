import { defineStore } from 'pinia'
import { useAllDeliveryZones } from '~/composables/delivery/useAllDeliveryZones'

// Зоны доставки нужны в заказах, на странице зон и на странице филиалов,
// поэтому держим в сторе, чтобы не создавать отдельный fetch и подписку на каждый маунт.
export const useDeliveryZoneStore = defineStore('deliveryZone', () => {
  const { zones, loading, add, update, remove } = useAllDeliveryZones()

  return { zones, loading, add, update, remove }
})
