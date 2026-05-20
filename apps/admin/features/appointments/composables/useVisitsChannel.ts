import { type Ref } from 'vue'
import type { Visit } from '@fastio/shared'
import { mapVisit } from '@fastio/shared'
import { createRealtimeBus } from '~/shared/data/createRealtimeBus'

export const visitsBus = createRealtimeBus<Visit>({
  table: 'appointment_groups',
  mapper: mapVisit,
  logTag: 'useVisitsChannel',
})

// PREPROD-260: branchId optional — при выборе филиала канал переподписан
// на `branch_id=eq.X`. NULL branch_id (legacy/cross-branch) визиты не
// попадают в канал когда branch выбран.
export function useVisitsChannel(tenantId: Ref<string | null>, branchId?: Ref<string | null>) {
  visitsBus.attach(tenantId, branchId)
}
