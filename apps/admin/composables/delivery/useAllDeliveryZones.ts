import { computed } from 'vue'
import type { DeliveryZone, DeliveryZoneFormData } from '@fastio/shared'
import { mapDeliveryZone } from '~/utils/api/delivery-zones'
import { useRealtimeList } from '~/composables/data/useRealtimeList'
import { useDatabase } from '~/composables/data/useDatabase'
import { useTenantStore } from '~/stores/tenant'

export const useAllDeliveryZones = () => {
  const api = useDatabase()
  const tenantStore = useTenantStore()
  const tenantId = computed(() => tenantStore.tenant?.id ?? '')

  const { items: zones, loading } = useRealtimeList({
    channelKey: computed(() => tenantId.value ? `delivery_zones_all:${tenantId.value}` : null),
    table: 'delivery_zones',
    filter: computed(() => `tenant_id=eq.${tenantId.value}`),
    fetch: () => api.deliveryZones.listAll(tenantId.value),
    mapper: mapDeliveryZone,
  })

  const add = async (data: DeliveryZoneFormData) => {
    if (!tenantId.value) return null

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
