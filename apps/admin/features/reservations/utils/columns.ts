import { h } from 'vue'
import { NInputNumber } from 'naive-ui'
import { UiButton, UiTag } from '@fastio/ui'
import type { DataTableColumns } from '@fastio/ui'
import type { Ref } from 'vue'
import type { Reservation } from '@fastio/shared'
import { formatPhone } from '@fastio/shared'
import {
  RESERVATION_STATUS_LABELS as STATUS_LABELS,
  RESERVATION_STATUS_TYPES as STATUS_TYPES,
  RESERVATION_STATUS_FILTER_OPTIONS,
} from './reservation-constants'

const dateColumn = {
  title: 'Дата',
  key: 'reservedDate',
  width: 160,
  sorter: (a: Reservation, b: Reservation) => `${a.reservedDate} ${a.reservedTime}`.localeCompare(`${b.reservedDate} ${b.reservedTime}`),
  render: (row: Reservation) => {
    const d = new Date(`${row.reservedDate}T12:00:00Z`)
    const weekday = d.toLocaleDateString('ru-RU', { weekday: 'short' })

    return h('div', { style: 'line-height: 1.3' }, [
      h('div', { style: 'font-size: 13px' }, `${row.reservedDate} (${weekday})`),
      h('div', { style: 'font-size: 15px; font-weight: 600; color: var(--color-primary)' }, row.reservedTime),
    ])
  },
}

type FilterOption = { label: string; value: string }

type Deps = {
  onEdit: (row: Reservation) => void
  tableNames: string[]
  showTable?: boolean
  guestMin: Ref<number | null>
  guestMax: Ref<number | null>
  guestMinDraft: Ref<number | null>
  guestMaxDraft: Ref<number | null>
  statusFilterOptions?: FilterOption[]
}

export const buildReservationColumns = ({
  tableNames,
  showTable = true,
  guestMin,
  guestMax,
  guestMinDraft,
  guestMaxDraft,
  statusFilterOptions = RESERVATION_STATUS_FILTER_OPTIONS,
}: Deps): DataTableColumns<Reservation> => [
  dateColumn,
  {
    title: 'Гость',
    key: 'guestName',
    minWidth: 160,
    render: (row) => `${row.guestName} (${row.guestCount} чел.)`,
  },
  {
    title: 'Телефон',
    key: 'guestPhone',
    width: 160,
    render: (row) => formatPhone(row.guestPhone),
  },
  {
    title: 'Гостей',
    key: 'guestCount',
    width: 90,
    filterOptionValue: (guestMin.value !== null || guestMax.value !== null) ? 1 : null,
    filter: (_, row) => {
      if (guestMin.value !== null && row.guestCount < guestMin.value) return false
      if (guestMax.value !== null && row.guestCount > guestMax.value) return false

      return true
    },
    renderFilterMenu: ({ hide }) => h('div', { style: 'padding: 12px; display: flex; flex-direction: column; gap: 8px; min-width: 160px' }, [
      h(NInputNumber, {
        'value': guestMinDraft.value,
        'placeholder': 'От',
        'min': 1,
        'max': guestMaxDraft.value ?? undefined,
        'style': 'width: 100%',
        'onUpdate:value': (v: number | null) => { guestMinDraft.value = v },
      }),
      h(NInputNumber, {
        'value': guestMaxDraft.value,
        'placeholder': 'До',
        'min': guestMinDraft.value ?? 1,
        'style': 'width: 100%',
        'onUpdate:value': (v: number | null) => { guestMaxDraft.value = v },
      }),
      h('div', { style: 'display: flex; gap: 8px' }, [
        h(UiButton, {
          size: 'small',
          style: 'flex: 1',
          onClick: () => {
            guestMinDraft.value = null
            guestMaxDraft.value = null
            guestMin.value = null
            guestMax.value = null
            hide()
          },
        }, () => 'Сбросить'),
        h(UiButton, {
          type: 'primary',
          size: 'small',
          style: 'flex: 1',
          onClick: () => {
            guestMin.value = guestMinDraft.value
            guestMax.value = guestMaxDraft.value
            hide()
          },
        }, () => 'Применить'),
      ]),
    ]),
    render: (row) => String(row.guestCount),
  },
  ...(showTable
    ? [{
        title: 'Стол',
        key: 'tableName',
        width: 140,
        filterMultiple: false,
        filterOptions: tableNames.map((name) => ({ label: name, value: name })),
        filter: (value: string | number, row: Reservation) => row.tableName === value,
        render: (row: Reservation) => row.tableName ?? '—',
      }]
    : []),
  {
    title: 'Статус',
    key: 'status',
    width: 150,
    filterOptions: statusFilterOptions,
    // filter: true — фильтрация по статусу серверная (fetch в tables/reservations.vue
    // тянет нужные statuses). Дропдаун остаётся, но NDataTable не дублирует фильтр на клиенте.
    filter: true,
    render: (row) => h(UiTag, {
      type: STATUS_TYPES[row.status],
      round: true,
      size: 'small',
    }, () => STATUS_LABELS[row.status]),
  },
]
