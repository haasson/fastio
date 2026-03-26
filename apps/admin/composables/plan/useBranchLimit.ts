import { computed } from 'vue'
import { pluralize } from '@fastio/shared'
import { usePlanFeatures } from './usePlanFeatures'
import { usePlans } from './usePlans'
import { useBranchStore } from '~/stores/branch'

export const useBranchLimit = () => {
  const { plan } = usePlanFeatures()
  const { plans } = usePlans()
  const branchStore = useBranchStore()

  const maxBranches = computed(() => {
    const currentPlan = plans.value.find((p) => p.key === plan.value)

    return currentPlan?.maxBranches ?? 0
  })

  const canAddBranch = computed(() => {
    if (maxBranches.value === 0) return true // unlimited

    return branchStore.branches.length < maxBranches.value
  })

  const branchLimitReached = computed(() => !canAddBranch.value)

  const branchLimitLabel = computed(() => pluralize(maxBranches.value, 'филиал', 'филиала', 'филиалов'))

  return { maxBranches, canAddBranch, branchLimitReached, branchLimitLabel }
}
