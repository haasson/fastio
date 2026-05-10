import { computed, h } from 'vue'
import type { ComputedRef, Ref } from 'vue'
import { UiButton, UiText, UiTag } from '@fastio/ui'
import type { DataTableColumns } from '@fastio/ui'
import {
  formatMinutes,
  VISIT_AGGREGATE_STATUS_LABELS,
  VISIT_AGGREGATE_STATUS_TAG_TYPES,
} from '@fastio/shared'
import type { InboxRow, VisitListRow } from '@fastio/shared'

export type RowActionKind = 'confirm' | 'cancel'

type Params = {
  branchMap: ComputedRef<Map<string, string>>
  timezone: Ref<string>
  rowLoading: Ref<Record<string, RowActionKind>>
  canManage: ComputedRef<boolean>
  onConfirmVisit: (row: VisitListRow) => void
  onCancelVisit: (row: VisitListRow) => void
  onOpenRow: (row: InboxRow) => void
}

export function useInboxTableColumns(params: Params) {
  const formatShortDate = (iso: string): string => {
    const parts = new Intl.DateTimeFormat('ru', {
      timeZone: params.timezone.value,
      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
    }).formatToParts(new Date(iso))
    const p = (type: string) => parts.find((x) => x.type === type)?.value ?? ''

    return `${p('day')}.${p('month')} ${p('hour')}:${p('minute')}`
  }

  const renderActions = (row: InboxRow) => {
    const id = row.id
    const currentAction = params.rowLoading.value[id] ?? null
    const isBusy = currentAction !== null
    const canManage = params.canManage.value

    const openBtn = (label: string, type: 'text' | 'primary' = 'text') => h(UiButton, {
      type, size: 'small', class: type === 'text' ? 'btn-muted' : undefined,
      onClick: (e: MouseEvent) => {
        e.stopPropagation()
        params.onOpenRow(row)
      },
    }, () => label)

    const cancelBtn = () => h(UiButton, {
      size: 'small',
      loading: currentAction === 'cancel',
      disabled: !canManage || isBusy,
      class: 'btn-danger',
      onClick: (e: MouseEvent) => {
        e.stopPropagation()
        params.onCancelVisit(row)
      },
    }, () => 'Отменить')

    // Финальные состояния — только «Открыть».
    if (row.aggregateStatus === 'cancelled' || row.aggregateStatus === 'done') {
      return openBtn('→ Открыть')
    }

    // Заявка → «Открыть» (для оформления слотов) + «Отменить».
    if (row.aggregateStatus === 'request') {
      return h('div', { class: 'action-btns' }, [
        openBtn('Открыть', 'primary'),
        cancelBtn(),
      ])
    }

    // Только pending имеет смысл «Принять» (есть услуги new).
    if (row.aggregateStatus === 'pending') {
      return h('div', { class: 'action-btns' }, [
        h(UiButton, {
          type: 'primary',
          size: 'small',
          loading: currentAction === 'confirm',
          disabled: !canManage || isBusy,
          onClick: (e: MouseEvent) => {
            e.stopPropagation()
            params.onConfirmVisit(row)
          },
        }, () => 'Принять'),
        cancelBtn(),
      ])
    }

    // confirmed / mixed — нечего принимать, но можно открыть/отменить.
    return h('div', { class: 'action-btns' }, [
      openBtn('Открыть', 'primary'),
      cancelBtn(),
    ])
  }

  const columns = computed<DataTableColumns<InboxRow>>(() => [
    {
      title: 'Тип',
      key: 'kind',
      width: 110,
      render: (row) => {
        if (row.aggregateStatus === 'request') {
          return h(UiTag, { type: 'primary', size: 'small', empty: true }, () => 'Заявка')
        }

        return h(UiTag, { type: 'default', size: 'small', empty: true }, () => 'Визит')
      },
    },
    {
      title: 'Клиент',
      key: 'customer',
      width: 210,
      render: (row) => h('div', { class: 'cell-stack' }, [
        h(UiText, { size: 'tiny', class: 'cell-name' }, () => row.customerName),
        h(UiText, { size: 'tiny', class: 'muted' }, () => row.customerPhone),
      ]),
    },
    {
      title: 'Услуги',
      key: 'services',
      render: (row) => h(UiText, { size: 'tiny' }, () => row.servicesList.join(', ') || '—'),
    },
    {
      title: 'Дата визита',
      key: 'visitDate',
      width: 130,
      render: (row) => {
        if (row.firstStartsAt) {
          return h(UiText, { size: 'tiny' }, () => formatShortDate(row.firstStartsAt!))
        }

        return h(UiText, { size: 'tiny', class: 'muted' }, () => '—')
      },
    },
    {
      title: 'Длит.',
      key: 'duration',
      width: 90,
      render: (row) => {
        if (!row.totalDurationMinutes) return h(UiText, { size: 'tiny', class: 'muted' }, () => '—')

        return h(UiText, { size: 'tiny' }, () => formatMinutes(row.totalDurationMinutes))
      },
    },
    {
      title: 'Статус',
      key: 'status',
      width: 170,
      render: (row) => h(UiTag, {
        type: VISIT_AGGREGATE_STATUS_TAG_TYPES[row.aggregateStatus] ?? 'default',
        size: 'small', empty: true,
      }, () => VISIT_AGGREGATE_STATUS_LABELS[row.aggregateStatus] ?? row.aggregateStatus),
    },
    {
      title: 'Филиал',
      key: 'branch',
      width: 150,
      render: (row) => {
        const name = row.branchId ? (params.branchMap.value.get(row.branchId) ?? '—') : '—'

        return h(UiText, { size: 'tiny' }, () => name)
      },
    },
    {
      title: 'Создана',
      key: 'createdAt',
      width: 120,
      render: (row) => h(UiText, { size: 'tiny' }, () => formatShortDate(row.createdAt)),
    },
    {
      title: '',
      key: 'actions',
      width: 200,
      render: renderActions,
    },
  ])

  return { columns }
}
