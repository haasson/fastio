import { ref, computed, watch } from 'vue'
import type { Ref } from 'vue'
import type {
  Visit,
  VisitListRow,
  InboxRow,
  InboxFilter,
  VisitAggregateStatus,
  AppointmentStatus,
} from '@fastio/shared'
import { useDatabase } from '~/composables/data/useDatabase'
import { useMessage } from '@fastio/ui'
import { reportError } from '~/utils/reportError'
import type { VisitFilter } from '~/utils/api/services/visits'

export type { VisitListRow, InboxRow, InboxFilter, VisitAggregateStatus }

const PAGE_SIZE = 30
const MIXED_PAGE_LIMIT = 1000

const aggregateFromVisit = (
  visit: Visit,
  counts: Partial<Record<AppointmentStatus, number>>,
): VisitAggregateStatus => {
  if (visit.status === 'request') return 'request'
  if (visit.status === 'cancelled') return 'cancelled'

  const newC = counts.new ?? 0
  const confC = counts.confirmed ?? 0
  const doneC = counts.done ?? 0
  const cancC = counts.cancelled ?? 0
  const total = newC + confC + doneC + cancC

  if (total === 0) return 'pending'
  if (newC > 0) return 'pending'
  if (cancC === total) return 'cancelled'
  if (doneC > 0 && newC === 0 && confC === 0 && doneC + cancC === total) return 'done'
  if (confC + doneC === total) return 'confirmed'

  return 'mixed'
}

export const useVisitsList = (params: {
  tenantId: Ref<string | null>
  timezone: Ref<string>
  filter: Ref<InboxFilter>
  page: Ref<number>
}) => {
  const { tenantId, timezone, filter, page } = params
  const api = useDatabase()
  const message = useMessage()

  const loading = ref(false)
  const allRows = ref<InboxRow[]>([])

  const jsRows = computed<InboxRow[]>(() => {
    const from = (page.value - 1) * PAGE_SIZE

    return allRows.value.slice(from, from + PAGE_SIZE)
  })

  const rows = computed<InboxRow[]>(() => jsRows.value)
  const total = computed(() => allRows.value.length)
  const totalPages = computed(() => Math.ceil(total.value / PAGE_SIZE) || 1)

  const enrichVisits = async (visits: Visit[]): Promise<VisitListRow[]> => {
    // Для request-визитов (нет appointments) detail-loader пропускаем — services
    // берём из requested_services.
    const activeIds = visits.filter((v) => v.status !== 'request').map((v) => v.id)
    const detailsMap = activeIds.length
      ? await api.visits.batchLoadAppointmentDetails(activeIds)
      : new Map()

    return visits.map((v) => {
      if (v.status === 'request') {
        const services = (v.requestedServices ?? []).map((s) => s.serviceName)
        const totalDuration = (v.requestedServices ?? []).reduce((s, x) => s + x.durationMinutes, 0)

        return {
          ...v,
          kind: 'visit' as const,
          servicesList: services,
          firstStartsAt: null,
          totalDurationMinutes: totalDuration,
          statusCounts: {},
          aggregateStatus: 'request' as VisitAggregateStatus,
        }
      }

      const d = detailsMap.get(v.id)
      const counts = d?.statusCounts ?? {}

      return {
        ...v,
        kind: 'visit' as const,
        servicesList: d?.servicesList ?? [],
        firstStartsAt: d?.firstStartsAt ?? null,
        totalDurationMinutes: d?.totalDurationMinutes ?? 0,
        statusCounts: counts,
        aggregateStatus: aggregateFromVisit(v, counts),
      }
    })
  }

  const fetch = async () => {
    if (!tenantId.value) return
    loading.value = true
    try {
      const f = filter.value
      const tid = tenantId.value
      const tz = timezone.value

      const visitFilter: VisitFilter = f === 'today' ? 'today' : f === 'week' ? 'week' : f === 'archive' ? 'archive' : f === 'all' ? 'all' : 'new'
      const visitsRes = await api.visits.list(tid, {
        page: 1, pageSize: MIXED_PAGE_LIMIT, filter: visitFilter, tz,
      })

      const enriched = await enrichVisits(visitsRes.data)

      // Постфильтр по агрегату:
      //   new:      request OR pending (требуют действий менеджера)
      //   archive:  done (визит закрыт) OR cancelled (отменён)
      //   today/week/all — без фильтра
      const filtered = enriched.filter((v) => {
        if (f === 'new') return v.aggregateStatus === 'pending' || v.aggregateStatus === 'request'
        if (f === 'archive') return v.aggregateStatus === 'done' || v.aggregateStatus === 'cancelled'

        return true
      })

      const dateSort = f === 'today' || f === 'week'
      const getSortMs = (row: InboxRow): number => {
        if (dateSort && row.firstStartsAt) return new Date(row.firstStartsAt).getTime()

        return new Date(row.createdAt).getTime()
      }

      const merged = filtered.sort((a, b) => dateSort ? getSortMs(a) - getSortMs(b) : getSortMs(b) - getSortMs(a))

      allRows.value = merged
    } catch (e) {
      reportError(e)
      message.error('Не удалось загрузить записи')
    } finally {
      loading.value = false
    }
  }

  watch([tenantId, filter], ([tid]) => {
    if (!tid) return
    fetch()
  }, { immediate: true })

  return {
    loading,
    rows,
    total,
    totalPages,
    pageSize: PAGE_SIZE,
    refresh: fetch,
  }
}
