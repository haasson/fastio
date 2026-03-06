import { computed } from 'vue'
import type { Dish } from '@fastio/shared'
import { mapDish, type DishFormData } from '~/utils/api/dishes'
import { useRealtimeList } from '~/composables/useRealtimeList'
import { useSupabaseApi } from '~/composables/useSupabaseApi'

export function useDishes(tenantId: Ref<string>, categoryId: Ref<string | null>) {
  const api = useSupabaseApi()

  const { items: dishes, loading } = useRealtimeList({
    channelKey: computed(() => tenantId.value && categoryId.value ? `dishes:${tenantId.value}:${categoryId.value}` : null),
    table: 'dishes',
    filter: computed(() => `tenant_id=eq.${tenantId.value}`),
    fetch: () => api.dishes.list(tenantId.value, categoryId.value!),
    mapper: mapDish,
    shouldInclude: (dish) => dish.categoryId === categoryId.value,
  })

  const add = async (data: DishFormData) => {
    if (!tenantId.value) return
    const dish = await api.dishes.add(tenantId.value, { ...data, order: dishes.value.length })

    if (dish && dish.categoryId === categoryId.value) dishes.value.push(dish)
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
    await api.dishes.remove(id)
    dishes.value = dishes.value.filter((d) => d.id !== id)
  }

  const toggleActive = async (id: string, active: boolean) => {
    const dish = dishes.value.find((d) => d.id === id)

    if (dish) dish.active = active
    await api.dishes.toggleActive(id, active)
  }

  const reorder = async (reordered: Dish[]) => {
    dishes.value = reordered
    await api.dishes.reorder(reordered.map((d, i) => ({ id: d.id, order: i })))
  }

  return { dishes, loading, add, update, remove, toggleActive, reorder }
}
