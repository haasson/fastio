import { computed } from 'vue'
import { pluralize } from '@fastio/shared'
import { useAccess } from './useAccess'

export const useBranchLimit = () => {
  const access = useAccess()

  const maxBranches = access.branchesMax
  const canAddBranch = access.canAddBranch
  const branchLimitReached = computed(() => !canAddBranch.value)
  const branchLimitLabel = computed(() => pluralize(maxBranches.value, 'филиал', 'филиала', 'филиалов'))

  return { maxBranches, canAddBranch, branchLimitReached, branchLimitLabel }
}
