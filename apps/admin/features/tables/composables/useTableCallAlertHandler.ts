import { onUnmounted } from 'vue'
import { tableCallEvents } from './useTableCallsChannel'
import { alertTableCall } from '~/shared/utils/alerts'

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
