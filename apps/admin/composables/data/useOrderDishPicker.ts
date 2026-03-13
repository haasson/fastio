import { ref, type Ref } from 'vue'
import type { Category, Combo, Dish } from '@fastio/shared'
import { useDatabase } from '~/composables/data/useDatabase'

export const useOrderDishPicker = (tenantId: Ref<string>) => {
  const api = useDatabase()

  const loading = ref(false)
  const categories = ref<Category[]>([])
  const allDishes = ref<Dish[]>([])
  const allCombos = ref<Combo[]>([])

  const fetchData = async () => {
    loading.value = true
    const [cats, dishes, combos] = await Promise.all([
      api.categories.list(tenantId.value),
      api.dishes.listAllActive(tenantId.value),
      api.combos.listAllActive(tenantId.value),
    ])

    categories.value = cats
    allDishes.value = dishes
    allCombos.value = combos
    loading.value = false
  }

  const getDishModifiers = (dishId: string) => api.dishes.getDishModifiers(dishId)

  return { loading, categories, allDishes, allCombos, fetchData, getDishModifiers }
}
