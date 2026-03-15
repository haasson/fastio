import { computed, h, type Ref } from 'vue'
import { useLocalStorage } from '@vueuse/core'
import { UiTag, UiText, UiButton } from '@fastio/ui'
import type { DataTableColumns } from '@fastio/ui'
import type { Order, OrderStatus } from '@fastio/shared'
import { formatPhone } from '@fastio/shared'
import AppActionsBlock from '~/components/ui/AppActionsBlock.vue'
import { STATUS_GROUP_TAG_TYPES } from '~/config/order-status-groups'
import { DELIVERY_TYPE_LABELS, PAYMENT_TYPE_LABELS } from '~/config/order-options'
import { formatRelativeTime } from '~/utils/formatRelativeTime'

type Branch = { id: string; name: string }

type UseOrderTableOptions = {
  statuses: OrderStatus[]
  updatingIds: Set<string>
  sortBy: Ref<string>
  sortDir: Ref<'asc' | 'desc'>
  filterDeliveryTypes: Ref<string[]>
  filterPaymentTypes: Ref<string[]>
  filterBranchIds: Ref<string[]>
  branchId: Ref<string | null>
  branches: Branch[]
  onEdit: (order: Order) => void
  onStatusChange: (id: string, statusId: string) => void
  getBranchName: (id: string | null | undefined) => string | undefined
}

export const COLUMN_OPTIONS = [
  { label: 'Имя', value: 'customerName' },
  { label: 'Телефон', value: 'customerPhone' },
  { label: 'Состав', value: 'items' },
  { label: 'Доставка', value: 'deliveryType' },
  { label: 'Оплата', value: 'paymentType' },
  { label: 'Филиал', value: 'branchId' },
  { label: 'Время', value: 'created_at' },
  { label: 'Сумма', value: 'total' },
]

const DEFAULT_COLUMNS = COLUMN_OPTIONS.map((c) => c.value)
const VALID_COLUMN_KEYS = new Set(DEFAULT_COLUMNS)

const DELIVERY_FILTER_OPTIONS = [
  { label: 'Доставка', value: 'delivery' },
  { label: 'Самовывоз', value: 'pickup' },
]

const PAYMENT_FILTER_OPTIONS = [
  { label: 'Наличные', value: 'cash' },
  { label: 'Карта', value: 'card' },
  { label: 'Онлайн', value: 'online' },
]

export function useOrderTable(options: UseOrderTableOptions) {
  const {
    statuses,
    updatingIds,
    sortBy,
    sortDir,
    filterDeliveryTypes,
    filterPaymentTypes,
    filterBranchIds,
    branchId,
    branches,
    onEdit,
    onStatusChange,
    getBranchName,
  } = options

  const _storedColumns = useLocalStorage<string[]>('orders:list-columns', DEFAULT_COLUMNS)
  const visibleColumns = computed({
    get: () => _storedColumns.value.filter((k) => VALID_COLUMN_KEYS.has(k)),
    set: (val: string[]) => { _storedColumns.value = val },
  })

  const isVisible = (key: string) => visibleColumns.value.includes(key)

  const columnMenuItems = computed(() => COLUMN_OPTIONS.map((col) => ({
    name: col.value,
    label: col.label,
    checked: isVisible(col.value),
  })),
  )

  const toggleColumn = (key: string) => {
    if (isVisible(key)) {
      visibleColumns.value = visibleColumns.value.filter((k) => k !== key)
    } else {
      visibleColumns.value = [...visibleColumns.value, key]
    }
  }

  const sortOrderFor = (key: string) => {
    if (sortBy.value !== key) return false

    return sortDir.value === 'asc' ? 'ascend' : 'descend'
  }

  const columns = computed<DataTableColumns<Order>>(() => {
    const branchFilterOptions = branches.map((b) => ({ label: b.name, value: b.id }))

    return [
      { type: 'selection' },
      {
        title: '#',
        key: 'id',
        width: 90,
        render: (row) => {
          const groupType = statuses.find((s) => s.id === row.status)?.groupType
          const tagType = groupType ? STATUS_GROUP_TAG_TYPES[groupType] : 'default'

          return h(UiTag, { type: tagType, size: 'small', round: true }, () => `#${row.id.slice(0, 6).toUpperCase()}`)
        },
      },
      ...isVisible('customerName')
        ? [{
            title: 'Имя',
            key: 'customerName',
            minWidth: 120,
            render: (row: Order) => h('span', { class: 'customer-name' }, row.customerName),
          }]
        : [],
      ...isVisible('customerPhone')
        ? [{
            title: 'Телефон',
            key: 'customerPhone',
            width: 160,
            render: (row: Order) => h('span', { class: 'customer-phone' }, formatPhone(row.customerPhone)),
          }]
        : [],
      ...isVisible('items')
        ? [{
            title: 'Состав',
            key: 'items',
            minWidth: 160,
            render: (row: Order) => h(
              UiText,
              { size: 'tiny', style: 'color: var(--color-text-secondary)' },
              () => row.items.map((i) => `${i.dishName} × ${i.quantity}`).join(', '),
            ),
          }]
        : [],
      ...isVisible('deliveryType')
        ? [{
            title: 'Доставка',
            key: 'deliveryType',
            width: 130,
            filterOptions: DELIVERY_FILTER_OPTIONS,
            filterOptionValues: filterDeliveryTypes.value.length > 0 ? filterDeliveryTypes.value : null,
            filter: () => true,
            render: (row: Order) => h(
              UiTag,
              { size: 'tiny', icon: row.deliveryType === 'delivery' ? 'bike' : undefined },
              () => DELIVERY_TYPE_LABELS[row.deliveryType],
            ),
          }]
        : [],
      ...isVisible('paymentType')
        ? [{
            title: 'Оплата',
            key: 'paymentType',
            width: 130,
            filterOptions: PAYMENT_FILTER_OPTIONS,
            filterOptionValues: filterPaymentTypes.value.length > 0 ? filterPaymentTypes.value : null,
            filter: () => true,
            render: (row: Order) => h(UiText, { size: 'tiny' }, () => PAYMENT_TYPE_LABELS[row.paymentType] ?? row.paymentType),
          }]
        : [],
      ...isVisible('created_at')
        ? [{
            title: 'Время',
            key: 'created_at',
            width: 90,
            sorter: true,
            sortOrder: sortOrderFor('created_at'),
            render: (row: Order) => h('span', { class: 'col-time' }, formatRelativeTime(row.createdAt, new Date())),
          }]
        : [],
      ...isVisible('total')
        ? [{
            title: 'Сумма',
            key: 'total',
            width: 90,
            sorter: true,
            sortOrder: sortOrderFor('total'),
            render: (row: Order) => h('span', { class: 'col-total' }, `${row.total} ₽`),
          }]
        : [],
      ...(branchId.value === null && branchFilterOptions.length > 1 && isVisible('branchId'))
        ? [{
            title: 'Филиал',
            key: 'branchId',
            width: 140,
            filterOptions: branchFilterOptions,
            filterOptionValues: filterBranchIds.value.length > 0 ? filterBranchIds.value : null,
            filter: () => true,
            render: (row: Order) => h(UiText, { size: 'tiny' }, () => getBranchName(row.branchId) ?? '—'),
          }]
        : [],
      {
        title: '',
        key: 'actions',
        minWidth: 56,
        render: (row) => {
          const currentStatus = statuses.find((s) => s.id === row.status)
          const quickActions = (currentStatus?.quickActions ?? [])
            .map((id) => statuses.find((s) => s.id === id))
            .filter(Boolean) as OrderStatus[]

          return h(AppActionsBlock, {
            showDelete: false,
            size: 'small',
            onEdit: (e: Event) => {
              e.stopPropagation()
              onEdit(row)
            },
          }, {
            prepend: () => quickActions.map((target) => h(UiButton, {
              key: target.id,
              type: STATUS_GROUP_TAG_TYPES[target.groupType],
              ghost: true,
              size: 'tiny',
              disabled: updatingIds.has(row.id),
              onClick: (e: Event) => {
                e.stopPropagation()
                onStatusChange(row.id, target.id)
              },
            }, () => target.name),
            ),
          })
        },
      },
    ]
  })

  return { columns, visibleColumns, columnMenuItems, toggleColumn }
}
