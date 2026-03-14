import { h } from 'vue'
import { UiTag, UiText, UiButton, UiSpace, UiSwitch } from '@fastio/ui'
import type { DataTableColumn } from '@fastio/ui'
import { formatDateShort } from '~/utils/formatDate'
import { effectivePromoStatus, PROMO_STATUS_FILTER_OPTIONS } from '~/utils/promoStatus'

type PromoLike = {
  id: string
  active: boolean
  activeFrom: string | null
  activeTo: string | null
}

type ActionsDeps<T> = {
  onToggle: (id: string, active: boolean) => void
  onEdit: (row: T) => void
  onRemove: (row: T) => void
}

export const buildPromoStatusColumn = <T extends PromoLike>(): DataTableColumn<T> => ({
  title: 'Статус',
  key: 'active',
  width: 130,
  filterOptions: PROMO_STATUS_FILTER_OPTIONS,
  filter: (value, row) => effectivePromoStatus(row).key === value,
  render: (row) => {
    const s = effectivePromoStatus(row)

    return h(UiTag, { type: s.type, size: 'small' }, () => s.label)
  },
})

export const buildPromoActivePeriodColumn = <T extends PromoLike>(): DataTableColumn<T> => ({
  title: 'Период',
  key: 'activeDates',
  width: 180,
  sorter: (a, b) => (a.activeFrom ?? '').localeCompare(b.activeFrom ?? ''),
  render: (row) => {
    if (!row.activeFrom && !row.activeTo) return h(UiText, { size: 'tiny', style: 'color: var(--color-text-secondary)' }, () => '—')
    const parts = []

    if (row.activeFrom) parts.push(`с ${formatDateShort(row.activeFrom)}`)
    if (row.activeTo) parts.push(`по ${formatDateShort(row.activeTo)}`)

    return h(UiText, { size: 'tiny', style: 'color: var(--color-text-secondary)' }, () => parts.join(' '))
  },
})

export const buildPromoActionsColumn = <T extends PromoLike>(deps: ActionsDeps<T>): DataTableColumn<T> => {
  const { onToggle, onEdit, onRemove } = deps

  return {
    title: '',
    key: 'actions',
    width: 120,
    render: (row) => h(UiSpace, { size: 8 }, () => [
      h(UiSwitch, { 'modelValue': row.active, 'onUpdate:modelValue': (v: boolean) => onToggle(row.id, v) }),
      h(UiButton, { type: 'text', size: 'medium', icon: 'pencil', iconBg: '#3b82f6', onClick: () => onEdit(row) }),
      h(UiButton, { type: 'text', size: 'medium', icon: 'trash', iconBg: '#ef4444', onClick: () => onRemove(row) }),
    ]),
  }
}
