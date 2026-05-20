import { computed, type Ref } from 'vue'
import type { PromoCodeFormData } from '@fastio/shared'
import { useRealtimeList } from '~/shared/data/useRealtimeList'
import { useDatabase } from '~/shared/data/useDatabase'
import { useAuditLog } from '~/features/audit-log'
import { mapPromoCode } from '../api/promo-codes'
import { pickFields } from '~/features/audit-log'

export function usePromoCodes(tenantId: Ref<string>) {
  const api = useDatabase()
  const { log } = useAuditLog()

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
    log({
      action: 'promo_code.create',
      entityType: 'promo_code',
      entityId: item.id,
      entityName: item.code,
      payload: { discountType: item.discountType, discountValue: item.discountValue },
    })
  }

  const update = async (id: string, data: Partial<PromoCodeFormData>) => {
    const before = promoCodes.value.find((p) => p.id === id)
    const item = await api.promoCodes.update(id, data)

    if (!item) return
    const i = promoCodes.value.findIndex((p) => p.id === id)

    if (i !== -1) promoCodes.value[i] = item
    log({
      action: 'promo_code.update',
      entityType: 'promo_code',
      entityId: id,
      entityName: item.code,
      payload: {
        changed: Object.keys(data),
        before: pickFields(before, Object.keys(data)),
        after: pickFields(item, Object.keys(data)),
      },
    })
  }

  const remove = async (id: string) => {
    const item = promoCodes.value.find((p) => p.id === id)

    await api.promoCodes.remove(id)
    promoCodes.value = promoCodes.value.filter((p) => p.id !== id)
    log({
      action: 'promo_code.delete',
      entityType: 'promo_code',
      entityId: id,
      entityName: item?.code ?? null,
      payload: { discountType: item?.discountType, discountValue: item?.discountValue },
    })
  }

  const toggleActive = async (id: string, active: boolean) => {
    const item = promoCodes.value.find((p) => p.id === id)

    if (item) item.active = active
    try {
      await api.promoCodes.update(id, { active })
      log({
        action: 'promo_code.toggle',
        entityType: 'promo_code',
        entityId: id,
        entityName: item?.code ?? null,
        payload: { active },
      })
    } catch (e) {
      if (item) item.active = !active
      throw e
    }
  }

  return { promoCodes, loading, add, update, remove, toggleActive }
}
