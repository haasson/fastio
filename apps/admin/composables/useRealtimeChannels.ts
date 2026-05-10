import { type Ref } from 'vue'
import { useOrdersChannel } from '~/features/orders'
import { useOrderAlertHandler } from '~/features/orders'
import { useTableCallsChannel } from '~/features/tables'
import { useTableCallAlertHandler } from '~/features/tables'
import { useKitchenQueueChannel } from '~/features/kitchen'
import { useReservationsChannel } from '~/features/reservations'
import { useReservationAlertHandler } from '~/features/reservations'
import { useSupportChannel } from '~/features/support'
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
