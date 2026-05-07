import { onUnmounted } from 'vue'
import { reservationEvents } from '~/composables/retail/useReservationsChannel'
import { useNewReservationCounter } from '~/composables/retail/useNewReservationCounter'

/**
 * Reacts to new reservations from the shared channel: counter.
 * Call in layout after useReservationsChannel.
 */
export function useReservationAlertHandler() {
  const { increment } = useNewReservationCounter()

  const off = reservationEvents.onInsert(() => {
    increment()
  })

  onUnmounted(off)
}
