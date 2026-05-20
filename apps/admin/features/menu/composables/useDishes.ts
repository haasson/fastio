import { computed, type Ref } from 'vue'
import type { Dish } from '@fastio/shared'
import { mapDish, type DishFormData } from '../api/dishes'
import { useRealtimeList } from '~/shared/data/useRealtimeList'
import { useDatabase } from '~/shared/data/useDatabase'
import { useAuditLog } from '~/features/audit-log'
import { reportError } from '@fastio/shared/observability'

export function useDishes(tenantId: Ref<string>, categoryId: Ref<string | null>) {
  const api = useDatabase()
  const { log } = useAuditLog()

  const { items: dishes, loading } = useRealtimeList({
    channelKey: computed(() => tenantId.value && categoryId.value ? `dishes:${tenantId.value}:${categoryId.value}` : null),
    table: 'dishes',
    filter: computed(() => `tenant_id=eq.${tenantId.value}`),
    fetch: () => api.dishes.list(tenantId.value, categoryId.value!),
    mapper: mapDish,
    shouldInclude: (dish) => dish.categoryId === categoryId.value,
  })

  const add = async (data: DishFormData): Promise<Dish | null> => {
    if (!tenantId.value) return null
    const dish = await api.dishes.add(tenantId.value, { ...data, order: dishes.value.length })

    if (dish && dish.categoryId === categoryId.value) dishes.value.push(dish)

    return dish
  }

  const update = async (id: string, data: Partial<DishFormData>) => {
    const dish = await api.dishes.update(id, data)

    if (!dish) return
    const i = dishes.value.findIndex((d) => d.id === id)

    if (i === -1) return
    if (dish.categoryId !== categoryId.value) {
      dishes.value.splice(i, 1)
    } else {
      dishes.value[i] = dish
    }
  }

  const remove = async (id: string) => {
    const dish = dishes.value.find((d) => d.id === id)

    await api.dishes.remove(id)
    dishes.value = dishes.value.filter((d) => d.id !== id)
    log({
      action: 'dish.delete',
      entityType: 'dish',
      entityId: id,
      entityName: dish?.name ?? null,
      payload: { categoryId: dish?.categoryId ?? null, price: dish?.price ?? null },
    })
  }

  const toggleActive = async (id: string, active: boolean) => {
    const dish = dishes.value.find((d) => d.id === id)

    if (!dish) return
    const prev = dish.active

    dish.active = active
    try {
      await api.dishes.toggleActive(id, active)
    } catch (e) {
      dish.active = prev
      reportError(e)
      throw e
    }
  }

  const reorder = async (reordered: Dish[]) => {
    const prev = dishes.value

    dishes.value = reordered
    try {
      await api.dishes.reorder(reordered.map((d, i) => ({ id: d.id, order: i })))
    } catch (e) {
      dishes.value = prev
      reportError(e)
      throw e
    }
  }

  return { dishes, loading, add, update, remove, toggleActive, reorder }
}
