import { type Ref } from 'vue'
import type { Appointment } from '@fastio/shared'
import { mapAppointment } from '@fastio/shared'
import { createRealtimeBus } from '~/composables/data/createRealtimeBus'

/**
 * Realtime broker для appointments — отдельный от `api.appointmentEvents` (CRUD журнала).
 * Подписка на onInsert/onUpdate/onDelete через Supabase Realtime channel.
 */
export const appointmentBus = createRealtimeBus<Appointment>({
  table: 'appointments',
  mapper: mapAppointment,
  logTag: 'useAppointmentsChannel',
})

export function useAppointmentsChannel(tenantId: Ref<string | null>) {
  appointmentBus.attach(tenantId)
}
