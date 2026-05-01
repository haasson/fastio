import { computed, h } from 'vue'
import type { ComputedRef, Ref } from 'vue'
import { UiButton, UiText, UiTag } from '@fastio/ui'
import type { DataTableColumns } from '@fastio/ui'
import {
  APPOINTMENT_GROUP_STATUS_LABELS,
  APPOINTMENT_GROUP_STATUS_TAG_TYPES,
  APPOINTMENT_REQUEST_STATUS_LABELS,
  APPOINTMENT_REQUEST_STATUS_TAG_TYPES,
  formatPrice, formatMinutes,
} from '@fastio/shared'
import type { InboxRow, GroupListRow, RequestListRow } from '@fastio/shared'

export type RowActionKind = 'confirm' | 'cancel' | 'inProgress' | 'decline'

type Params = {
  branchMap: ComputedRef<Map<string, string>>
  timezone: Ref<string>
  rowLoading: Ref<Record<string, RowActionKind>>
  canManage: ComputedRef<boolean>
  onConfirmGroup: (row: GroupListRow) => void
  onCancelGroup: (row: GroupListRow) => void
  onMarkInProgress: (row: RequestListRow) => void
  onDeclineRequest: (row: RequestListRow) => void
  onOpenRow: (row: InboxRow) => void
}

export function useInboxTableColumns(params: Params) {
  // Компактный формат «25.04 14:30» в TZ тенанта — для ячеек таблицы инбокса.
  // Отдельная функция, потому что shared `formatDateTime` использует месяц словом
  // («25 апр, 14:30») и не принимает TZ — а здесь нужен tz.value тенанта.
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

    if (row.kind === 'group') {
      const status = (row as GroupListRow).status

      if (status === 'new') {
        return h('div', { class: 'action-btns' }, [
          h(UiButton, {
            type: 'primary',
            size: 'small',
            loading: currentAction === 'confirm',
            disabled: !canManage || isBusy,
            onClick: (e: MouseEvent) => {
              e.stopPropagation()
              params.onConfirmGroup(row as GroupListRow)
            },
          }, () => 'Подтвердить'),
          h(UiButton, {
            size: 'small',
            loading: currentAction === 'cancel',
            disabled: !canManage || isBusy,
            class: 'btn-danger',
            onClick: (e: MouseEvent) => {
              e.stopPropagation()
              params.onCancelGroup(row as GroupListRow)
            },
          }, () => 'Отменить'),
        ])
      }
      const isArchived = status === 'cancelled' || status === 'done'

      return h(UiButton, {
        type: 'text',
        size: 'small',
        class: isArchived ? 'btn-muted' : '',
        onClick: (e: MouseEvent) => {
          e.stopPropagation()
          params.onOpenRow(row)
        },
      }, () => '→ Открыть')
    }

    const status = (row as RequestListRow).status

    if (status === 'new') {
      return h('div', { class: 'action-btns' }, [
        h(UiButton, {
          size: 'small',
          loading: currentAction === 'inProgress',
          disabled: !canManage || isBusy,
          onClick: (e: MouseEvent) => {
            e.stopPropagation()
            params.onMarkInProgress(row as RequestListRow)
          },
        }, () => 'В работу'),
        h(UiButton, {
          size: 'small',
          loading: currentAction === 'decline',
          disabled: !canManage || isBusy,
          class: 'btn-danger',
          onClick: (e: MouseEvent) => {
            e.stopPropagation()
            params.onDeclineRequest(row as RequestListRow)
          },
        }, () => 'Отклонить'),
      ])
    }
    const isArchived = status === 'converted' || status === 'declined'

    return h(UiButton, {
      type: 'text',
      size: 'small',
      class: isArchived ? 'btn-muted' : '',
      onClick: (e: MouseEvent) => {
        e.stopPropagation()
        params.onOpenRow(row)
      },
    }, () => '→ Открыть')
  }

  const columns = computed<DataTableColumns<InboxRow>>(() => [
    {
      title: 'Тип',
      key: 'kind',
      width: 110,
      render: (row) => row.kind === 'group'
        ? h(UiTag, { type: 'primary', size: 'small', empty: true }, () => '📅 Запись')
        : h(UiTag, { type: 'default', size: 'small', empty: true }, () => '✉️ Заявка'),
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
      render: (row) => {
        const names = row.kind === 'group'
          ? (row as GroupListRow).servicesList.join(', ')
          : (row as RequestListRow).services.map((s) => s.serviceName).join(', ')

        return h(UiText, { size: 'tiny' }, () => names || '—')
      },
    },
    {
      title: 'Дата визита',
      key: 'visitDate',
      width: 130,
      render: (row) => {
        if (row.kind === 'group' && (row as GroupListRow).firstStartsAt) {
          return h(UiText, { size: 'tiny' }, () => formatShortDate((row as GroupListRow).firstStartsAt!))
        }

        return h(UiText, { size: 'tiny', class: 'muted' }, () => '—')
      },
    },
    {
      title: 'Цена',
      key: 'price',
      width: 110,
      render: (row) => {
        const price = row.kind === 'group'
          ? (row as GroupListRow).totalPrice
          : (row as RequestListRow).services.reduce((s, x) => s + x.price, 0)

        if (!price) return h(UiText, { size: 'tiny', class: 'muted' }, () => '—')

        return h(UiText, { size: 'tiny' }, () => formatPrice(price))
      },
    },
    {
      title: 'Длит.',
      key: 'duration',
      width: 90,
      render: (row) => {
        const mins = row.kind === 'group'
          ? (row as GroupListRow).totalDurationMinutes
          : (row as RequestListRow).services.reduce((s, x) => s + x.durationMinutes, 0)

        if (!mins) return h(UiText, { size: 'tiny', class: 'muted' }, () => '—')

        return h(UiText, { size: 'tiny' }, () => formatMinutes(mins))
      },
    },
    {
      title: 'Статус',
      key: 'status',
      width: 170,
      render: (row) => {
        if (row.kind === 'group') {
          const s = (row as GroupListRow).status

          return h(UiTag, { type: APPOINTMENT_GROUP_STATUS_TAG_TYPES[s] ?? 'default', size: 'small', empty: true }, () => APPOINTMENT_GROUP_STATUS_LABELS[s])
        }
        const s = (row as RequestListRow).status

        return h(UiTag, { type: APPOINTMENT_REQUEST_STATUS_TAG_TYPES[s] ?? 'default', size: 'small', empty: true }, () => APPOINTMENT_REQUEST_STATUS_LABELS[s])
      },
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
