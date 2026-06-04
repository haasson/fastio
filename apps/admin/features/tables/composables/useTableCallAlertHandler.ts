import { onUnmounted } from 'vue'
import { storeToRefs } from 'pinia'
import { tableCallEvents } from './useTableCallsChannel'
import { getTableBranchId } from './useTablesChannel'
import { alertTableCall } from '~/shared/utils/alerts'
import { useBranchStore } from '~/shared/stores/branch'

/**
 * Reacts to new table calls from the shared channel: sound + OS notification.
 * Fires only for the currently selected branch (or all branches if none selected).
 * Call in layout after useTableCallsChannel.
 */
export function useTableCallAlertHandler() {
  const branchStore = useBranchStore()
  const { currentBranchId } = storeToRefs(branchStore)

  const off = tableCallEvents.onInsert((call) => {
    // null = «все филиалы» — алертим всё; иначе только вызовы своего филиала
    if (currentBranchId.value !== null) {
      const tableBranch = getTableBranchId(call.tableId)

      if (tableBranch !== currentBranchId.value) return
    }
    alertTableCall(call.callTypeName)
  })

  onUnmounted(off)
}
