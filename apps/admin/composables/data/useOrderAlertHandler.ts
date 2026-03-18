import { onUnmounted } from 'vue'
import { orderEvents } from '~/composables/data/useOrdersChannel'
import { useNewOrderCounter } from '~/composables/data/useNewOrderCounter'
import { alertNewOrder } from '~/composables/data/useAlerts'

/**
 * Reacts to new orders from the shared channel: counter + alert.
 * Call in layout after useOrdersChannel.
 */
export function useOrderAlertHandler() {
  const { increment } = useNewOrderCounter()

  const off = orderEvents.onInsert(() => {
    increment()
    alertNewOrder()
  })

  onUnmounted(off)
}
