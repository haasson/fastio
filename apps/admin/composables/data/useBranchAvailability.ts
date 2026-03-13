import { reactive, type Ref } from 'vue'
import type { Branch } from '@fastio/shared'

export const useBranchAvailability = (branches: Ref<Branch[]>) => {
  // null = inherit global active, false = disabled for this branch
  const branchActive = reactive<Record<string, boolean | null>>({})

  const resetAvailability = () => {
    branches.value.forEach((b) => {
      branchActive[b.id] = null
    })
  }

  const applyAvailability = (data: { branchId: string; active: boolean | null }[]) => {
    data.forEach((s) => {
      branchActive[s.branchId] = s.active ?? null
    })
  }

  return { branchActive, resetAvailability, applyAvailability }
}

export default useBranchAvailability
