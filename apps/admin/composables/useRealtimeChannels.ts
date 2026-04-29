import { type Ref } from 'vue'
import { useOrdersChannel } from '~/composables/data/useOrdersChannel'
import { useOrderAlertHandler } from '~/composables/data/useOrderAlertHandler'
import { useTableCallsChannel } from '~/composables/data/useTableCallsChannel'
import { useTableCallAlertHandler } from '~/composables/data/useTableCallAlertHandler'
import { useKitchenQueueChannel } from '~/composables/data/useKitchenQueueChannel'
import { useReservationsChannel } from '~/composables/data/useReservationsChannel'
import { useReservationAlertHandler } from '~/composables/data/useReservationAlertHandler'
import { useSupportChannel } from '~/composables/data/useSupportChannel'
import { useAppointmentsChannel } from '~/composables/data/useAppointmentsChannel'
import { useAppointmentAlertHandler } from '~/composables/data/useAppointmentAlertHandler'

export function useRealtimeChannels(tenantId: Ref<string | null>) {
  useOrdersChannel(tenantId)
  useOrderAlertHandler()

  useTableCallsChannel(tenantId)
  useTableCallAlertHandler()

  useKitchenQueueChannel(tenantId)

  useReservationsChannel(tenantId)
  useReservationAlertHandler()

  useSupportChannel(tenantId)

  useAppointmentsChannel(tenantId)
  useAppointmentAlertHandler()
}
