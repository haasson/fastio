import { computed, type Ref } from 'vue'
import type { ServiceFormData, ServiceWithBranchIds } from '@fastio/shared'
import { mapService } from '@fastio/shared'
import { useRealtimeList } from '~/shared/data/useRealtimeList'
import { useDatabase } from '~/shared/data/useDatabase'
import { reportError } from '@fastio/shared/observability'

export function useServices(tenantId: Ref<string>, categoryId: Ref<string | null>) {
  const api = useDatabase()

  // На UPDATE / INSERT realtime присылает только колонки `services`, junction
  // `service_branches` мы получить из payload не можем. Маппер сохраняет branchIds
  // из текущего состояния списка (для UPDATE), а для нового элемента (INSERT)
  // догружает их фоном через enrichBranchIds. Без этого realtime-эхо после save
  // затирало бы выбор филиалов.
  //
  // mapper и enrichBranchIds объявлены через function declarations (hoisted) и
  // ссылаются на `services` через closure: к моменту реального вызова mapper'a
  // (внутри useRealtimeList) services уже инициализирован.
  function mapper(raw: Record<string, unknown>): ServiceWithBranchIds {
    const mapped = mapService(raw)
    const existing = services.value.find((s) => s.id === mapped.id)

    if (existing) return { ...mapped, branchIds: existing.branchIds }

    void enrichBranchIds(mapped.id)

    return { ...mapped, branchIds: [] }
  }

  async function enrichBranchIds(id: string) {
    try {
      const branchIds = await api.services.getBranchIds(id)
      const idx = services.value.findIndex((s) => s.id === id)

      if (idx !== -1) services.value[idx] = { ...services.value[idx], branchIds }
    } catch (e) {
      reportError(e)
    }
  }

  const { items: services, loading } = useRealtimeList<ServiceWithBranchIds>({
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
