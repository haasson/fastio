import { computed, type Ref } from 'vue'
import type { ServiceFormData, ServiceWithBranchIds } from '@fastio/shared'
import { mapService } from '@fastio/shared'
import { useRealtimeList } from '~/composables/data/useRealtimeList'
import { useDatabase } from '~/composables/data/useDatabase'
import { reportError } from '~/utils/reportError'

export function useServices(tenantId: Ref<string>, categoryId: Ref<string | null>) {
  const api = useDatabase()

  // Realtime-маппер `mapService` возвращает Service без `branchIds` — на UPDATE
  // payload junction-таблица не известна. Догружаем ids отдельно.
  const mapper = (raw: Record<string, unknown>): ServiceWithBranchIds => ({
    ...mapService(raw),
    branchIds: [],
  })

  const { items: services, loading } = useRealtimeList({
    channelKey: computed(() => tenantId.value && categoryId.value ? `services:${tenantId.value}:${categoryId.value}` : null),
    table: 'services',
    filter: computed(() => `tenant_id=eq.${tenantId.value}`),
    fetch: () => api.services.list(tenantId.value),
    mapper,
    shouldInclude: (svc) => svc.categoryId === categoryId.value,
  })

  const update = async (id: string, data: Partial<ServiceFormData>) => {
    const svc = await api.services.update(id, data)
    const i = services.value.findIndex((s) => s.id === id)

    if (i === -1) return
    if (svc.categoryId !== categoryId.value) {
      services.value.splice(i, 1)
    } else {
      services.value[i] = svc
    }
  }

  const remove = async (id: string) => {
    await api.services.remove(id)
    services.value = services.value.filter((s) => s.id !== id)
  }

  const toggleActive = async (id: string, active: boolean) => {
    const svc = services.value.find((s) => s.id === id)
    const prev = svc?.active

    if (svc) svc.active = active
    try {
      await api.services.update(id, { active })
    } catch (e) {
      if (svc && prev !== undefined) svc.active = prev
      reportError(e)
      throw e
    }
  }

  const reorder = async (reordered: ServiceWithBranchIds[]) => {
    const prev = services.value

    services.value = reordered
    try {
      await api.services.reorder(reordered.map((s, i) => ({ id: s.id, sortOrder: i })))
    } catch (e) {
      services.value = prev
      reportError(e)
      throw e
    }
  }

  return { services, loading, update, remove, toggleActive, reorder }
}
