import { ref, type Ref } from 'vue'
import type { Category, Dish } from '@fastio/shared'
import { useDatabase } from '~/composables/data/useDatabase'

export const useOrderDishPicker = (tenantId: Ref<string>) => {
  const api = useDatabase()

  const loading = ref(false)
  const categories = ref<Category[]>([])
  const allDishes = ref<Dish[]>([])

  const fetchData = async () => {
    loading.value = true
    const [cats, dishes] = await Promise.all([
      api.categories.list(tenantId.value),
      api.dishes.listAllActive(tenantId.value),
    ])

    categories.value = cats
    allDishes.value = dishes
    loading.value = false
  }

  const getDishModifiers = (dishId: string) => api.dishes.getDishModifiers(dishId)

  return { loading, categories, allDishes, fetchData, getDishModifiers }
}
