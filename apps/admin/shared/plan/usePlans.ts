import { ref } from 'vue'
import type { Plan, PlanTier } from '@fastio/shared'
import { PLAN_LEVEL_ORDER, extractPlanTier } from '@fastio/shared'
import { useDatabase } from '~/shared/data/useDatabase'
import { reportError } from '~/shared/utils/reportError'

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
      reportError(e)
    }
  }

  const invalidate = () => {
    loaded.value = false
  }

  const getPlanSortOrder = (key: string): number => {
    const tier = extractPlanTier(key)

    // До загрузки — всё кроме showcase залочено (безопасный дефолт)
    if (!loaded.value) return tier === 'showcase' ? 0 : Infinity

    return PLAN_LEVEL_ORDER[tier as PlanTier] ?? 0
  }

  const getPlanLabel = (key: string): string => {
    const tier = extractPlanTier(key)
    const plan = plans.value.find((p) => p.key === key) ?? plans.value.find((p) => extractPlanTier(p.key) === tier)

    return plan?.name ?? key
  }

  return { plans, load, invalidate, getPlanSortOrder, getPlanLabel }
}
