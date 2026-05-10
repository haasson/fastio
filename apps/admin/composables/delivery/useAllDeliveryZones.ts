import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import type { DeliveryZone, DeliveryZoneFormData } from '@fastio/shared'
import { mapDeliveryZone } from '~/features/orders'
import { useRealtimeList } from '~/composables/data/useRealtimeList'
import { useDatabase } from '~/composables/data/useDatabase'
import { useTenantStore } from '~/shared/stores/tenant'

export const useAllDeliveryZones = () => {
  const api = useDatabase()
  const { tenantId } = storeToRefs(useTenantStore())

  const { items: zones, loading } = useRealtimeList({
    channelKey: computed(() => `delivery_zones_all:${tenantId.value}`),
    table: 'delivery_zones',
    filter: computed(() => `tenant_id=eq.${tenantId.value}`),
    fetch: () => api.deliveryZones.listAll(tenantId.value),
    mapper: mapDeliveryZone,
  })

  const add = async (data: DeliveryZoneFormData) => {
    const zone = await api.deliveryZones.add(tenantId.value, data)

    if (zone) zones.value.push(zone)

    return zone
  }

  const update = async (id: string, data: Partial<DeliveryZoneFormData>) => {
    const zone = await api.deliveryZones.update(id, data)

    if (zone) {
      const i = zones.value.findIndex((z: DeliveryZone) => z.id === id)

      if (i !== -1) zones.value[i] = zone
    }

    return zone
  }

  const remove = async (id: string) => {
    await api.deliveryZones.remove(id)
    zones.value = zones.value.filter((z: DeliveryZone) => z.id !== id)
  }

  return { zones, loading, add, update, remove }
}
