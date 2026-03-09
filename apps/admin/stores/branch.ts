import { defineStore } from 'pinia'
import { computed } from 'vue'
import { useBranches } from '~/composables/data/useBranches'
import { useBranch } from '~/composables/data/useBranch'
import { useTenantStore } from './tenant'

// Список и текущий филиал нужны во многих компонентах (layout, orders, menu и др.),
// поэтому держим их в сторе, чтобы не пробрасывать пропами.
// Вся логика работы с API и realtime живёт в useBranches,
// логика текущего выбора — в useBranch.
// Стор только связывает их с текущим тенантом и делает глобальными.
export const useBranchStore = defineStore('branch', () => {
  const tenantStore = useTenantStore()

  // currentTenantId (а не tenant?.id) — чтобы реагировать на смену тенанта
  // немедленно, до загрузки данных нового тенанта
  const tenantId = computed(() => tenantStore.currentTenantId ?? '')

  const membership = computed(() => tenantStore.memberships.find((m) => m.tenantId === tenantStore.currentTenantId),
  )
  const memberBranchIds = computed(() => membership.value?.branchIds ?? [])
  const isAdmin = computed(() => membership.value?.role === 'owner' || membership.value?.role === 'admin',
  )

  const { branches, archivedBranches, loading, add, update, archive, restore } = useBranches(tenantId)
  const { currentBranchId, currentBranch, hasBranches, setBranch, dispose } = useBranch(
    tenantId,
    branches,
    memberBranchIds,
    isAdmin,
  )

  return {
    branches,
    archivedBranches,
    loading,
    currentBranchId,
    currentBranch,
    hasBranches,
    add,
    update,
    archive,
    restore,
    setBranch,
    dispose,
  }
})
