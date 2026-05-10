import type { ResourceSlotData } from '@fastio/shared'
import { useTenantStore } from '~/shared/stores/tenant'
import { useDatabase } from '~/shared/data/useDatabase'
import {
  checkAppointmentsAgainstSchedule, type ScheduleConflict,
} from '../utils/scheduleConflictCheck'

const HORIZON_DAYS = 180

type ResourceCheck = {
  id: string
  name: string
  slotData: ResourceSlotData
}

/**
 * Загружает активные записи (new/confirmed) каждого ресурса в окне now..+180 дней
 * и проверяет, попадёт ли каждая запись в новое расписание (slotData).
 *
 * Используется при редактировании шаблона (для всех привязанных ресурсов) и при
 * смене шаблона/cycle_start_date на одном ресурсе. Без мутаций БД.
 */
export function useScheduleConflictCheck() {
  const tenantStore = useTenantStore()
  const api = useDatabase()

  const findConflicts = async (resources: ResourceCheck[]): Promise<ScheduleConflict[]> => {
    const tid = tenantStore.currentTenantId

    if (!tid || resources.length === 0) return []

    const tz = tenantStore.tenant.timezone

    const now = new Date()
    const dateFrom = now.toISOString()
    const horizon = new Date(now.getTime() + HORIZON_DAYS * 86_400_000)
    const dateTo = horizon.toISOString()

    const all: ScheduleConflict[] = []

    for (const r of resources) {
      const apptsRes = await api.appointments.listPaginated(tid, {
        resourceId: r.id,
        dateFrom,
        dateTo,
        statuses: ['new', 'confirmed'],
        page: 1,
        pageSize: 500,
        sortDir: 'asc',
      })

      const conflicts = checkAppointmentsAgainstSchedule(
        apptsRes.data.map((a) => ({
          id: a.id,
          resourceId: a.resourceId ?? r.id,
          startsAt: a.startsAt,
          endsAt: a.endsAt,
          customerName: a.customerName,
          status: a.status,
        })),
        r.name,
        r.slotData,
        tz,
      )

      all.push(...conflicts)
    }

    return all
  }

  return { findConflicts }
}
