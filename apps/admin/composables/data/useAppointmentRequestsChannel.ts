import { type Ref } from 'vue'
import type { AppointmentRequest } from '@fastio/shared'
import { mapAppointmentRequest } from '@fastio/shared'
import { createRealtimeBus } from '~/composables/data/createRealtimeBus'

export const appointmentRequestBus = createRealtimeBus<AppointmentRequest>({
  table: 'appointment_requests',
  mapper: mapAppointmentRequest,
  logTag: 'useAppointmentRequestsChannel',
})

export function useAppointmentRequestsChannel(tenantId: Ref<string | null>) {
  appointmentRequestBus.attach(tenantId)
}
