import { defineStore, storeToRefs } from 'pinia'
import { computed } from 'vue'
import { useReservations } from '~/composables/data/useReservations'
import { useTenantStore } from './tenant'
import { useBranchStore } from './branch'

export const useReservationsStore = defineStore('reservations', () => {
  const tenantStore = useTenantStore()
  const branchStore = useBranchStore()
  const tenantId = computed(() => tenantStore.currentTenantId ?? '')
  const { currentBranchId: branchId } = storeToRefs(branchStore)

  return useReservations(tenantId, branchId)
})
