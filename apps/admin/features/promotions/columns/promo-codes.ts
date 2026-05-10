import { h } from 'vue'
import { UiText } from '@fastio/ui'
import type { DataTableColumns } from '@fastio/ui'
import type { PromoCode } from '@fastio/shared'
import { buildPromoStatusColumn, buildPromoActivePeriodColumn, buildPromoActionsColumn } from './_shared'

type Deps = {
  onToggle: (id: string, active: boolean) => void
  onEdit: (promo: PromoCode) => void
  onRemove: (promo: PromoCode) => void
}

export const buildPromoCodeColumns = (deps: Deps): DataTableColumns<PromoCode> => {
  const { onToggle, onEdit, onRemove } = deps

  return [
    {
      title: 'Код',
      key: 'code',
      width: 160,
      sorter: (a, b) => a.code.localeCompare(b.code),
      render: (row) => h('span', { class: 'promo-code-text' }, row.code),
    },
    buildPromoStatusColumn<PromoCode>(),
    {
      title: 'Скидка',
      key: 'discountValue',
      width: 110,
      sorter: (a, b) => a.discountValue - b.discountValue,
      render: (row) => h(
        UiText,
        { size: 'tiny', style: 'color: var(--color-success); font-weight: 600' },
        () => row.discountType === 'percent' ? `−${row.discountValue}%` : `−${row.discountValue} ₽`,
      ),
    },
    {
      title: 'От суммы',
      key: 'minOrderAmount',
      width: 110,
      sorter: (a, b) => (a.minOrderAmount ?? 0) - (b.minOrderAmount ?? 0),
      render: (row) => h(UiText, { size: 'tiny', style: 'color: var(--color-text-secondary)' }, () => row.minOrderAmount ? `от ${row.minOrderAmount} ₽` : '—'),
    },
    {
      title: 'Использований',
      key: 'usedCount',
      width: 140,
      sorter: (a, b) => a.usedCount - b.usedCount,
      render: (row) => h(
        UiText,
        { size: 'tiny', style: 'color: var(--color-text-secondary)' },
        () => row.usageLimit != null ? `${row.usedCount} / ${row.usageLimit}` : `${row.usedCount}`,
      ),
    },
    buildPromoActivePeriodColumn<PromoCode>(),
    buildPromoActionsColumn<PromoCode>({ onToggle, onEdit, onRemove }),
  ]
}
