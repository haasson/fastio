import { type Ref } from 'vue'
import { useOrdersChannel } from '~/composables/retail/useOrdersChannel'
import { useOrderAlertHandler } from '~/composables/retail/useOrderAlertHandler'
import { useTableCallsChannel } from '~/composables/retail/useTableCallsChannel'
import { useTableCallAlertHandler } from '~/composables/retail/useTableCallAlertHandler'
import { useKitchenQueueChannel } from '~/features/kitchen'
import { useReservationsChannel } from '~/composables/retail/useReservationsChannel'
import { useReservationAlertHandler } from '~/composables/retail/useReservationAlertHandler'
import { useSupportChannel } from '~/composables/data/useSupportChannel'
import { useAppointmentsChannel, useVisitsChannel, useAppointmentInboxHandler } from '~/features/appointments'
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

  useVisitsChannel(tenantId)
  useAppointmentInboxHandler(tenantId)
}
