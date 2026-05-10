import { defineStore, storeToRefs } from 'pinia'
import { computed } from 'vue'
import { useReservations } from '../composables/useReservations'
import { useTenantStore } from '~/shared/stores/tenant'
import { useBranchStore } from '~/shared/stores/branch'

export const useReservationsStore = defineStore('reservations', () => {
  const tenantStore = useTenantStore()
  const branchStore = useBranchStore()
  const tenantId = computed(() => tenantStore.currentTenantId ?? '')
  const { currentBranchId: branchId } = storeToRefs(branchStore)

  return useReservations(tenantId, branchId)
})
