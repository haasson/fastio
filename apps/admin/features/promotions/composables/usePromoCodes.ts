import { computed, type Ref } from 'vue'
import type { PromoCodeFormData } from '@fastio/shared'
import { useRealtimeList } from '~/shared/data/useRealtimeList'
import { useDatabase } from '~/shared/data/useDatabase'
import { mapPromoCode } from '../api/promo-codes'

export function usePromoCodes(tenantId: Ref<string>) {
  const api = useDatabase()

  const { items: promoCodes, loading } = useRealtimeList({
    channelKey: computed(() => tenantId.value ? `promo_codes:${tenantId.value}` : null),
    table: 'promo_codes',
    filter: computed(() => `tenant_id=eq.${tenantId.value}`),
    fetch: () => api.promoCodes.list(tenantId.value),
    mapper: mapPromoCode,
  })

  const add = async (data: PromoCodeFormData) => {
    if (!tenantId.value) return
    const item = await api.promoCodes.add(tenantId.value, data)

    if (!item) return
    promoCodes.value.unshift(item)
  }

  const update = async (id: string, data: Partial<PromoCodeFormData>) => {
    const item = await api.promoCodes.update(id, data)

    if (!item) return
    const i = promoCodes.value.findIndex((p) => p.id === id)

    if (i !== -1) promoCodes.value[i] = item
  }

  const remove = async (id: string) => {
    await api.promoCodes.remove(id)
    promoCodes.value = promoCodes.value.filter((p) => p.id !== id)
  }

  const toggleActive = async (id: string, active: boolean) => {
    const item = promoCodes.value.find((p) => p.id === id)

    if (item) item.active = active
    try {
      await api.promoCodes.update(id, { active })
    } catch (e) {
      if (item) item.active = !active
      throw e
    }
  }

  return { promoCodes, loading, add, update, remove, toggleActive }
}
