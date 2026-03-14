import { h } from 'vue'
import { UiText } from '@fastio/ui'
import type { DataTableColumns } from '@fastio/ui'
import type { Promotion } from '@fastio/shared'
import { buildPromoStatusColumn, buildPromoActivePeriodColumn, buildPromoActionsColumn } from '~/columns/_promo-shared'

const PROMOTION_TYPE_LABELS: Record<string, string> = {
  min_order: 'от суммы заказа',
  happy_hour: 'happy hour',
  weekday: 'по дням недели',
  first_order: 'первый заказ',
  free_item: 'блюдо в подарок',
}

type Deps = {
  onToggle: (id: string, active: boolean) => void
  onEdit: (promo: Promotion) => void
  onRemove: (promo: Promotion) => void
}

export const buildPromotionColumns = (deps: Deps): DataTableColumns<Promotion> => {
  const { onToggle, onEdit, onRemove } = deps

  return [
    {
      title: 'Название',
      key: 'title',
      width: 220,
      sorter: (a, b) => a.title.localeCompare(b.title),
      render: (row) => h('div', { class: 'promo-title-cell' }, [
        h('span', { class: 'promo-title' }, row.title),
        h(UiText, { size: 'tiny', style: 'color: var(--color-text-secondary)' }, () => PROMOTION_TYPE_LABELS[row.type] ?? row.type),
      ]),
    },
    buildPromoStatusColumn<Promotion>(),
    {
      title: 'Скидка',
      key: 'discountValue',
      width: 130,
      sorter: (a, b) => a.discountValue - b.discountValue,
      render: (row) => {
        if (row.type === 'free_item') {
          return h(UiText, { size: 'tiny' }, () => `🎁 ${row.conditions.freeDishName ?? '—'}`)
        }

        return h(
          UiText,
          { size: 'tiny', style: 'color: var(--color-success); font-weight: 600' },
          () => row.discountType === 'percent' ? `−${row.discountValue}%` : `−${row.discountValue} ₽`,
        )
      },
    },
    buildPromoActivePeriodColumn<Promotion>(),
    buildPromoActionsColumn<Promotion>({ onToggle, onEdit, onRemove }),
  ]
}
