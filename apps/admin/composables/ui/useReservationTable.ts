import { ref, computed } from 'vue'
import type { Ref, ComputedRef } from 'vue'
import type { Reservation } from '@fastio/shared'
import { dateStrToTs, formatDateStr } from '@fastio/shared'
import { buildReservationColumns } from '~/columns/reservations'
import { useModules } from '~/composables/plan/useModules'

type FilterOption = { label: string; value: string }

export const RESERVATION_COLUMN_OPTIONS = [
  { label: 'Дата', value: 'reservedDate' },
  { label: 'Гость', value: 'guestName' },
  { label: 'Телефон', value: 'guestPhone' },
  { label: 'Гостей', value: 'guestCount' },
  { label: 'Стол', value: 'tableName' },
  { label: 'Статус', value: 'status' },
]

export const useReservationTable = (
  rows: Ref<Reservation[]> | ComputedRef<Reservation[]>,
  tableNames: Ref<string[]> | ComputedRef<string[]>,
  filterDate: Ref<string | null>,
  statusFilterOptions?: FilterOption[],
) => {
  const modules = useModules()
  const dineInEnabled = computed(() => modules.dineIn?.value?.enabled ?? false)

  const search = ref('')
  const visibleColumns = ref<string[]>(RESERVATION_COLUMN_OPTIONS.map((c) => c.value))
  const guestMin = ref<number | null>(null)
  const guestMax = ref<number | null>(null)
  const guestMinDraft = ref<number | null>(null)
  const guestMaxDraft = ref<number | null>(null)
  const tableFilters = ref<Record<string, string | number | (string | number)[] | null>>({})

  const filterDateTs = computed<number | null>({
    get: () => filterDate.value ? dateStrToTs(filterDate.value) : null,
    set: (val) => { filterDate.value = val ? formatDateStr(val) : null },
  })

  const tableFilterCount = computed(() => Object.values(tableFilters.value).filter((v) => v !== null && (Array.isArray(v) ? v.length > 0 : true)).length,
  )

  const activeFilterCount = computed(() => (filterDate.value ? 1 : 0)
    + (guestMin.value !== null || guestMax.value !== null ? 1 : 0)
    + (search.value ? 1 : 0)
    + tableFilterCount.value,
  )

  const clearFilters = () => {
    filterDate.value = null
    guestMin.value = null
    guestMax.value = null
    guestMinDraft.value = null
    guestMaxDraft.value = null
    search.value = ''
    tableFilters.value = {}
  }

  // Modal
  const modalOpen = ref(false)
  const selectedId = ref<string | null>(null)

  const selectedReservation = computed(() => selectedId.value ? (rows.value.find((r) => r.id === selectedId.value) ?? null) : null,
  )

  const openCreate = () => {
    selectedId.value = null
    modalOpen.value = true
  }
  const openEdit = (row: Reservation) => {
    selectedId.value = row.id
    modalOpen.value = true
  }

  const allColumns = computed(() => {
    // buildReservationColumns получает guestMin/guestMax как Ref-объекты и читает .value
    // в колбэках DataTable (вне computed) — без явного обращения здесь Vue не отследит
    // зависимость и computed не пересчитается при смене фильтра.
    void guestMin.value
    void guestMax.value

    return buildReservationColumns({
      onEdit: openEdit,
      tableNames: tableNames.value,
      showTable: dineInEnabled.value,
      guestMin,
      guestMax,
      guestMinDraft,
      guestMaxDraft,
      statusFilterOptions,
    })
  })

  const visibleColumnDefs = computed(() => allColumns.value.filter((col) => visibleColumns.value.includes(col.key as string)),
  )

  const onFiltersUpdate = (filters: Record<string, string | number | (string | number)[] | null>) => {
    tableFilters.value = filters
  }

  return {
    search,
    visibleColumns,
    filterDateTs,
    guestMin,
    guestMax,
    tableFilters,
    activeFilterCount,
    clearFilters,
    visibleColumnDefs,
    onFiltersUpdate,
    modalOpen,
    selectedReservation,
    openCreate,
    openEdit,
  }
}
