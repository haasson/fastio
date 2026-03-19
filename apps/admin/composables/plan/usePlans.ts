import { ref } from 'vue'
import type { Plan } from '@fastio/shared'
import { useDatabase } from '~/composables/data/useDatabase'

const plans = ref<Plan[]>([])
const loaded = ref(false)

export const usePlans = () => {
  const api = useDatabase()

  const load = async () => {
    if (loaded.value) return
    try {
      plans.value = await api.plans.list()
      loaded.value = true
    } catch (e) {
      console.error('Failed to load plans:', e)
    }
  }

  const invalidate = () => {
    loaded.value = false
  }

  const getPlanSortOrder = (key: string): number => {
    // До загрузки планов — всё кроме start залочено (безопасный дефолт)
    if (!loaded.value) return key === 'start' ? 0 : Infinity
    const plan = plans.value.find((p) => p.key === key)

    return plan?.sortOrder ?? 0
  }

  const getPlanLabel = (key: string): string => {
    const plan = plans.value.find((p) => p.key === key)

    return plan?.name ?? key
  }

  return { plans, load, invalidate, getPlanSortOrder, getPlanLabel }
}
