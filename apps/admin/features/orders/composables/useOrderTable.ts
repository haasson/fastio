import { computed, h, type Ref } from 'vue'
import { UiTag, UiText } from '@fastio/ui'
import type { DataTableColumn, DataTableColumns } from '@fastio/ui'
import type { Order, OrderStatus } from '@fastio/shared'
import { formatPhone, formatPrice } from '@fastio/shared'
import { STATUS_GROUP_TAG_TYPES } from '~/config/retail/order-status-groups'
import { DELIVERY_TYPE_LABELS, PAYMENT_TYPE_LABELS } from '~/config/retail/order-options'
import { formatRelativeTime } from '@fastio/shared'

type Branch = { id: string; name: string }

type UseOrderTableOptions = {
  statuses: OrderStatus[]
  sortBy: Ref<string>
  sortDir: Ref<'asc' | 'desc'>
  filterDeliveryTypes: Ref<string[]>
  filterPaymentTypes: Ref<string[]>
  filterBranchIds: Ref<string[]>
  branchId: Ref<string | null>
  branches: Branch[]
  visibleColumns: Ref<string[]>
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
    sortBy,
    sortDir,
    filterDeliveryTypes,
    filterPaymentTypes,
    filterBranchIds,
    branchId,
    branches,
    visibleColumns,
    getBranchName,
  } = options

  const isVisible = (key: string) => visibleColumns.value.includes(key)

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

          return h(UiTag, { type: tagType, size: 'small', round: true }, () => row.orderNumber)
        },
      },
      ...isVisible('customerName')
        ? [{
          title: 'Имя',
          key: 'customerName',
          minWidth: 120,
          render: (row: Order) => h('span', { class: 'customer-name' }, row.customerName ?? ''),
        } satisfies DataTableColumn<Order>]
        : [],
      ...isVisible('customerPhone')
        ? [{
          title: 'Телефон',
          key: 'customerPhone',
          width: 160,
          render: (row: Order) => h('span', { class: 'customer-phone' }, formatPhone(row.customerPhone)),
        } satisfies DataTableColumn<Order>]
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
        } satisfies DataTableColumn<Order>]
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
        } satisfies DataTableColumn<Order>]
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
        } satisfies DataTableColumn<Order>]
        : [],
      ...isVisible('created_at')
        ? [{
          title: 'Время',
          key: 'created_at',
          width: 90,
          sorter: true,
          sortOrder: sortOrderFor('created_at'),
          render: (row: Order) => h('span', { class: 'col-time' }, formatRelativeTime(row.createdAt, new Date())),
        } satisfies DataTableColumn<Order>]
        : [],
      ...isVisible('total')
        ? [{
          title: 'Сумма',
          key: 'total',
          width: 90,
          sorter: true,
          sortOrder: sortOrderFor('total'),
          render: (row: Order) => h('span', { class: 'col-total' }, formatPrice(row.total)),
        } satisfies DataTableColumn<Order>]
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
        } satisfies DataTableColumn<Order>]
        : [],
    ]
  })

  return { columns }
}
