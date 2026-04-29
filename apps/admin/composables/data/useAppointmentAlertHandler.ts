import { onUnmounted } from 'vue'
import { appointmentBus } from '~/composables/data/useAppointmentsChannel'
import { useNewAppointmentCounter } from '~/composables/data/useNewAppointmentCounter'

export function useAppointmentAlertHandler() {
  const { increment } = useNewAppointmentCounter()

  const off = appointmentBus.onInsert(() => {
    increment()
  })

  onUnmounted(off)
}
