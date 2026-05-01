import { type Ref } from 'vue'
import type { AppointmentGroup } from '@fastio/shared'
import { mapAppointmentGroup } from '@fastio/shared'
import { createRealtimeBus } from '~/composables/data/createRealtimeBus'

export const appointmentGroupBus = createRealtimeBus<AppointmentGroup>({
  table: 'appointment_groups',
  mapper: mapAppointmentGroup,
  logTag: 'useAppointmentGroupsChannel',
})

export function useAppointmentGroupsChannel(tenantId: Ref<string | null>) {
  appointmentGroupBus.attach(tenantId)
}
