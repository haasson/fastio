import { type Ref } from 'vue'
import type { Appointment } from '@fastio/shared'
import { mapAppointment } from '@fastio/shared'
import { createRealtimeBus } from '~/shared/data/createRealtimeBus'

/**
 * Realtime broker для appointments — отдельный от `api.appointmentEvents` (CRUD журнала).
 * Подписка на onInsert/onUpdate/onDelete через Supabase Realtime channel.
 */
export const appointmentBus = createRealtimeBus<Appointment>({
  table: 'appointments',
  mapper: mapAppointment,
  logTag: 'useAppointmentsChannel',
})

// PREPROD-260: branchId optional — при выборе филиала подписка
// переключается на `branch_id=eq.X`, чтобы не получать appointments других
// филиалов через сеть. Cross-branch (branch_id IS NULL) — редкая ситуация
// для services, такие записи не отображаются в UI пока branch выбран.
export function useAppointmentsChannel(tenantId: Ref<string | null>, branchId?: Ref<string | null>) {
  appointmentBus.attach(tenantId, branchId)
}
