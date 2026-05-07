import { ref, type Ref } from 'vue'
import type { Addon, Category, Combo, Dish } from '@fastio/shared'
import { useDatabase } from '~/composables/data/useDatabase'

export const useOrderDishPicker = (tenantId: Ref<string>) => {
  const api = useDatabase()

  const loading = ref(false)
  const categories = ref<Category[]>([])
  const allDishes = ref<Dish[]>([])
  const allCombos = ref<Combo[]>([])
  const allAddons = ref<Addon[]>([])

  const fetchData = async () => {
    loading.value = true
    const [cats, dishes, combos, addons] = await Promise.all([
      api.categories.list(tenantId.value),
      api.dishes.listAllActive(tenantId.value),
      api.combos.listAllActive(tenantId.value),
      api.addons.list(tenantId.value),
    ])

    categories.value = cats
    allDishes.value = dishes
    allCombos.value = combos
    allAddons.value = addons
    loading.value = false
  }

  const getDishModifiers = (dishId: string) => api.dishes.getDishModifiers(dishId)
  const getDishAddons = (dishId: string) => api.addons.getDishAddons(dishId)
  const listAddons = async () => {
    if (!allAddons.value.length) {
      allAddons.value = await api.addons.list(tenantId.value)
    }

    return allAddons.value
  }

  return { loading, categories, allDishes, allCombos, fetchData, getDishModifiers, getDishAddons, listAddons }
}
