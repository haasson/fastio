import { onUnmounted } from 'vue'
import { tableCallEvents } from '~/composables/data/useTableCallsChannel'
import { alertTableCall } from '~/utils/alerts'

/**
 * Reacts to new table calls from the shared channel: sound + OS notification.
 * Call in layout after useTableCallsChannel.
 */
export function useTableCallAlertHandler() {
  const off = tableCallEvents.onInsert((call) => {
    alertTableCall(call.callTypeName)
  })

  onUnmounted(off)
}
