import { onUnmounted } from 'vue'
import { orderEvents } from '~/composables/data/useOrdersChannel'
import { useNewOrderCounter } from '~/composables/data/useNewOrderCounter'

/**
 * Reacts to new orders from the shared channel: counter.
 * Call in layout after useOrdersChannel.
 */
export function useOrderAlertHandler() {
  const { increment } = useNewOrderCounter()

  const off = orderEvents.onInsert(() => {
    increment()
  })

  onUnmounted(off)
}
