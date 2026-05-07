import { type Ref } from 'vue'
import { useOrdersChannel } from '~/composables/retail/useOrdersChannel'
import { useOrderAlertHandler } from '~/composables/retail/useOrderAlertHandler'
import { useTableCallsChannel } from '~/composables/retail/useTableCallsChannel'
import { useTableCallAlertHandler } from '~/composables/retail/useTableCallAlertHandler'
import { useKitchenQueueChannel } from '~/composables/retail/useKitchenQueueChannel'
import { useReservationsChannel } from '~/composables/retail/useReservationsChannel'
import { useReservationAlertHandler } from '~/composables/retail/useReservationAlertHandler'
import { useSupportChannel } from '~/composables/data/useSupportChannel'
import { useAppointmentsChannel } from '~/composables/services/useAppointmentsChannel'
import { useVisitsChannel } from '~/composables/services/useVisitsChannel'
import { useAppointmentInboxHandler } from '~/composables/services/useAppointmentInboxHandler'

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
