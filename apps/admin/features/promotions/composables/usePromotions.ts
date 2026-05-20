import { computed, type Ref } from 'vue'
import type { PromotionFormData } from '@fastio/shared'
import { useRealtimeList } from '~/shared/data/useRealtimeList'
import { useDatabase } from '~/shared/data/useDatabase'
import { useAuditLog } from '~/features/audit-log'
import { mapPromotion } from '../api/promotions'
import { pickFields } from '~/features/audit-log'

export function usePromotions(tenantId: Ref<string>) {
  const api = useDatabase()
  const { log } = useAuditLog()

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

    if (!item) return
    promotions.value.unshift(item)
    log({
      action: 'promotion.create',
      entityType: 'promotion',
      entityId: item.id,
      entityName: item.title,
      payload: { type: item.type, discountType: item.discountType, discountValue: item.discountValue },
    })
  }

  const update = async (id: string, data: Partial<PromotionFormData>) => {
    const before = promotions.value.find((p) => p.id === id)
    const item = await api.promotions.update(id, data)

    if (!item) return
    const i = promotions.value.findIndex((p) => p.id === id)

    if (i !== -1) promotions.value[i] = item
    log({
      action: 'promotion.update',
      entityType: 'promotion',
      entityId: id,
      entityName: item.title,
      payload: {
        changed: Object.keys(data),
        before: pickFields(before, Object.keys(data)),
        after: pickFields(item, Object.keys(data)),
      },
    })
  }

  const remove = async (id: string) => {
    const item = promotions.value.find((p) => p.id === id)

    await api.promotions.remove(id)
    promotions.value = promotions.value.filter((p) => p.id !== id)
    log({
      action: 'promotion.delete',
      entityType: 'promotion',
      entityId: id,
      entityName: item?.title ?? null,
      payload: { type: item?.type, discountValue: item?.discountValue },
    })
  }

  const toggleActive = async (id: string, active: boolean) => {
    const item = promotions.value.find((p) => p.id === id)

    if (item) item.active = active
    try {
      await api.promotions.update(id, { active })
      log({
        action: 'promotion.toggle',
        entityType: 'promotion',
        entityId: id,
        entityName: item?.title ?? null,
        payload: { active },
      })
    } catch (e) {
      if (item) item.active = !active
      throw e
    }
  }

  return { promotions, loading, add, update, remove, toggleActive }
}
