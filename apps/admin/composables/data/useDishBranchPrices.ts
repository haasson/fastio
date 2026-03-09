import { ref, reactive, watch, type Ref } from 'vue'
import type { Branch, DishBranchPrice } from '@fastio/shared'
import { useDatabase } from '~/composables/data/useDatabase'

export const useDishBranchPrices = (
  dishId: Ref<string | null>,
  branches: Ref<Branch[]>,
  refreshKey: Ref<number>,
) => {
  const api = useDatabase()

  const useBranchPrices = ref(false)
  const branchPrices = reactive<Record<string, number | null>>({})

  const reset = () => {
    useBranchPrices.value = false
    branches.value.forEach((b) => {
      branchPrices[b.id] = null
    })
  }

  const load = async (id: string) => {
    const prices = await api.dishes.getBranchPrices(id)

    branches.value.forEach((b) => {
      branchPrices[b.id] = null
    })

    if (prices.length > 0) {
      useBranchPrices.value = true
      prices.forEach((p) => {
        branchPrices[p.branchId] = p.price
      })
    } else {
      useBranchPrices.value = false
    }
  }

  const onToggleBranchPrices = (val: boolean) => {
    if (!val) Object.keys(branchPrices).forEach((k) => {
      branchPrices[k] = null
    })
  }

  const getBranchPrices = (): DishBranchPrice[] => useBranchPrices.value
    ? branches.value
        .filter((b) => branchPrices[b.id] != null)
        .map((b) => ({ dishId: dishId.value!, branchId: b.id, price: branchPrices[b.id] as number }))
    : []

  watch(refreshKey, () => {
    if (dishId.value && branches.value.length > 0) {
      load(dishId.value)
    } else {
      reset()
    }
  }, { immediate: true })

  return { useBranchPrices, branchPrices, onToggleBranchPrices, getBranchPrices }
}
