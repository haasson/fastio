import { onUnmounted } from 'vue'
import { orderEvents } from '~/composables/retail/useOrdersChannel'
import { useNewOrderCounter } from '~/composables/retail/useNewOrderCounter'
import { alertNewOrder } from '~/utils/alerts'

/**
 * Reacts to new orders from the shared channel: counter + alert.
 * Call in layout after useOrdersChannel.
 */
export function useOrderAlertHandler() {
  const { increment } = useNewOrderCounter()

  const off = orderEvents.onInsert((order) => {
    if (order.deliveryType === 'dine_in') return

    increment()
    alertNewOrder()
  })

  onUnmounted(off)
}
