import { computed, type Ref } from 'vue'
import type { PromotionFormData } from '@fastio/shared'
import { useRealtimeList } from '~/composables/data/useRealtimeList'
import { useDatabase } from '~/composables/data/useDatabase'
import { mapPromotion } from '~/utils/api/promotions'

export function usePromotions(tenantId: Ref<string>) {
  const api = useDatabase()

  const { items: promotions, loading } = useRealtimeList({
    channelKey: computed(() => tenantId.value ? `promotions:${tenantId.value}` : null),
    table: 'promotions',
    filter: computed(() => `tenant_id=eq.${tenantId.value}`),
    fetch: () => api.promotions.list(tenantId.value),
    mapper: mapPromotion,
  })

  const add = async (data: PromotionFormData) => {
    if (!tenantId.value) return
    const item = await api.promotions.add(tenantId.value, data)

    if (item) promotions.value.unshift(item)
  }

  const update = async (id: string, data: Partial<PromotionFormData>) => {
    const item = await api.promotions.update(id, data)

    if (!item) return
    const i = promotions.value.findIndex((p) => p.id === id)

    if (i !== -1) promotions.value[i] = item
  }

  const remove = async (id: string) => {
    await api.promotions.remove(id)
    promotions.value = promotions.value.filter((p) => p.id !== id)
  }

  const toggleActive = async (id: string, active: boolean) => {
    const item = promotions.value.find((p) => p.id === id)

    if (item) item.active = active
    try {
      await api.promotions.update(id, { active })
    } catch (e) {
      if (item) item.active = !active
      throw e
    }
  }

  return { promotions, loading, add, update, remove, toggleActive }
}
