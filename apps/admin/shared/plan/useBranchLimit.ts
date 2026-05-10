import { computed } from 'vue'
import { pluralize } from '@fastio/shared'
import { useResolvedFeatures } from './useResolvedFeatures'
import { useGate } from './useGate'

export const useBranchLimit = () => {
  const { resolved } = useResolvedFeatures()
  const gate = useGate()

  // 0 = безлимит (модуль branches доступен), иначе 1 (только главный филиал)
  const maxBranches = computed(() => resolved.value.modules.branches ? 0 : 1)
  const canAddBranch = computed(() => gate.addBranch.value.enabled)
  const branchLimitReached = computed(() => !canAddBranch.value)
  const branchLimitLabel = computed(() => pluralize(maxBranches.value, 'филиал', 'филиала', 'филиалов'))

  return { maxBranches, canAddBranch, branchLimitReached, branchLimitLabel }
}
