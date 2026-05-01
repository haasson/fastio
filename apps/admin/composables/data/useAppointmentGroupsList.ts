import { ref, computed, watch } from 'vue'
import type { Ref } from 'vue'
import type { AppointmentGroup, GroupListRow, RequestListRow, InboxRow, InboxFilter } from '@fastio/shared'
import { useDatabase } from '~/composables/data/useDatabase'
import { useMessage } from '@fastio/ui'
import { reportError } from '~/utils/reportError'
import type { GroupFilter } from '~/utils/api/appointmentGroups'
import type { RequestFilter } from '~/utils/api/appointmentRequests'

export type { GroupListRow, RequestListRow, InboxRow, InboxFilter }

const PAGE_SIZE = 30

// Микс-фильтры (new/archive/all) сейчас грузят groups+requests двумя независимыми
// запросами и сортируют merge'ом в JS. Это допустимо пока активный инбокс
// тенанта не превышает MIXED_PAGE_LIMIT строк (десятки записей в день ⇒ месяцы
// до достижения лимита). При росте — переписать на серверный merge через RPC
// list_inbox с курсорной пагинацией. См. TECHDEBT.md → Admin → inbox merge.
const MIXED_PAGE_LIMIT = 1000

const MIXED_FILTERS = ['new', 'archive', 'all'] as const

type MixedFilter = (typeof MIXED_FILTERS)[number]

const toGroupFilter = (f: InboxFilter): GroupFilter => f
const toRequestFilter = (f: InboxFilter): RequestFilter => {
  if (f === 'today' || f === 'week') return 'all'

  return f as RequestFilter
}

export const useAppointmentGroupsList = (params: {
  tenantId: Ref<string | null>
  timezone: Ref<string>
  filter: Ref<InboxFilter>
  page: Ref<number>
}) => {
  const { tenantId, timezone, filter, page } = params
  const api = useDatabase()
  const message = useMessage()

  const loading = ref(false)

  const isMixedFilter = computed(() => MIXED_FILTERS.includes(filter.value as MixedFilter))

  // For today/week — server-side paginated groups only
  const dateRows = ref<GroupListRow[]>([])
  const dateTotal = ref(0)

  // For new/archive/all — all data in memory, JS-side pagination
  const allRows = ref<InboxRow[]>([])
  const jsRows = computed<InboxRow[]>(() => {
    const from = (page.value - 1) * PAGE_SIZE

    return allRows.value.slice(from, from + PAGE_SIZE)
  })

  const rows = computed<InboxRow[]>(() => (isMixedFilter.value ? jsRows.value : dateRows.value))
  const total = computed(() => (isMixedFilter.value ? allRows.value.length : dateTotal.value))
  const totalPages = computed(() => Math.ceil(total.value / PAGE_SIZE) || 1)

  const enrichGroups = async (groups: AppointmentGroup[]): Promise<GroupListRow[]> => {
    const ids = groups.map((g) => g.id)
    const detailsMap = await api.appointmentGroups.batchLoadAppointmentDetails(ids)

    return groups.map((g) => ({
      ...g,
      kind: 'group' as const,
      servicesList: detailsMap.get(g.id)?.servicesList ?? [],
      firstStartsAt: detailsMap.get(g.id)?.firstStartsAt ?? null,
    }))
  }

  const fetchMixed = async (f: MixedFilter) => {
    if (!tenantId.value) return
    loading.value = true
    try {
      const [groupsRes, requestsRes] = await Promise.all([
        api.appointmentGroups.list(tenantId.value, {
          page: 1,
          pageSize: MIXED_PAGE_LIMIT,
          filter: toGroupFilter(f),
          tz: timezone.value,
        }),
        api.appointmentRequests.list(tenantId.value, {
          page: 1,
          pageSize: MIXED_PAGE_LIMIT,
          filter: toRequestFilter(f),
        }),
      ])

      const enriched = await enrichGroups(groupsRes.data)
      const reqRows: RequestListRow[] = requestsRes.data.map((r) => ({ ...r, kind: 'request' as const }))

      const merged: InboxRow[] = [...enriched, ...reqRows].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )

      allRows.value = merged
    } catch (e) {
      reportError(e)
      message.error('Не удалось загрузить записи')
    } finally {
      loading.value = false
    }
  }

  const fetchDate = async (f: 'today' | 'week') => {
    if (!tenantId.value) return
    loading.value = true
    try {
      const res = await api.appointmentGroups.list(tenantId.value, {
        page: page.value,
        pageSize: PAGE_SIZE,
        filter: f,
        tz: timezone.value,
      })
      const enriched = await enrichGroups(res.data)

      dateRows.value = enriched
      dateTotal.value = res.total
    } catch (e) {
      reportError(e)
      message.error('Не удалось загрузить записи')
    } finally {
      loading.value = false
    }
  }

  const fetch = () => {
    const f = filter.value

    if (f === 'today' || f === 'week') fetchDate(f)
    else fetchMixed(f as MixedFilter)
  }

  // Смена тенанта или фильтра → всегда новый сетевой запрос.
  watch([tenantId, filter], ([tid]) => {
    if (!tid) return
    fetch()
  }, { immediate: true })

  // Пагинация: для микс-фильтров режется в JS из allRows, сеть не нужна.
  // Для today/week пагинация серверная — фетчим.
  watch(page, () => {
    if (!tenantId.value) return
    if (filter.value === 'today' || filter.value === 'week') fetchDate(filter.value)
  })

  return {
    loading,
    rows,
    total,
    totalPages,
    pageSize: PAGE_SIZE,
    refresh: fetch,
  }
}
