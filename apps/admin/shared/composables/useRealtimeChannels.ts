import { storeToRefs } from 'pinia'
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
import { useBranchStore } from '~/shared/stores/branch'

export function useRealtimeChannels(tenantId: Ref<string | null>) {
  // PREPROD-260: каналы с колонкой `branch_id` (orders, reservations,
  // appointments, appointment_groups) подписываются на конкретный филиал
  // когда он выбран. При смене branchId — каналы пересоздаются (см.
  // useRealtimeWatch).
  //
  // Не для всех: `table_calls`, `kitchen_queue`, `support_tickets` НЕ имеют
  // колонки `branch_id` — остаются tenant-level. table_calls связан с
  // филиалом через `table_id`, kitchen_queue — через `order_id`, support
  // глобален для тенанта.
  const branchStore = useBranchStore()
  const { currentBranchId } = storeToRefs(branchStore)

  useOrdersChannel(tenantId, currentBranchId)
  useOrderAlertHandler()

  useTableCallsChannel(tenantId)
  useTableCallAlertHandler()

  useKitchenQueueChannel(tenantId)

  useReservationsChannel(tenantId, currentBranchId)
  useReservationAlertHandler()

  useSupportChannel(tenantId)

  useAppointmentsChannel(tenantId, currentBranchId)

  useVisitsChannel(tenantId, currentBranchId)
  useAppointmentInboxHandler(tenantId)
}
