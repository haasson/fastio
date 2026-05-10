import { type Ref } from 'vue'
import type { Visit } from '@fastio/shared'
import { mapVisit } from '@fastio/shared'
import { createRealtimeBus } from '~/composables/data/createRealtimeBus'

export const visitsBus = createRealtimeBus<Visit>({
  table: 'appointment_groups',
  mapper: mapVisit,
  logTag: 'useVisitsChannel',
})

export function useVisitsChannel(tenantId: Ref<string | null>) {
  visitsBus.attach(tenantId)
}
