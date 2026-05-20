import { ref, watch, onUnmounted, getCurrentInstance, type Ref } from 'vue'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { useDatabase } from '~/shared/data/useDatabase'

type Handlers = {
  /** Колонка для фильтра. По умолчанию 'id' */
  column?: string
  onInsert?: (row: Record<string, unknown>) => void
  onUpdate?: (row: Record<string, unknown>) => void
  onDelete?: (row: Record<string, unknown>) => void
  /**
   * PREPROD-110: fires on connection transition false→true (reconnect after
   * disconnect). НЕ fires на initial SUBSCRIBED — для холодного старта
   * данные обычно уже загружены consumer'ом отдельно. Используется чтобы
   * подтянуть события, которые могли пропасть пока канал был оборван.
   */
  onReconnect?: () => void
  /**
   * PREPROD-260: вторичный фильтр (обычно `branch_id`). Если задан и
   * `.value !== null` — Realtime подпишется только на строки с этим
   * значением, экономя bandwidth при смене филиала.
   *
   * Лимит Supabase Realtime — один column в `filter`, поэтому когда задан
   * branch — он перекрывает primary tenant-фильтр (RLS на сервере всё равно
   * обеспечивает tenant-isolation). При `branchId.value === null` ("все
   * филиалы") — оставляем primary фильтр по tenant.
   *
   * Edge case: row с `branch_id IS NULL` (cross-branch операции) НЕ попадут
   * в канал, когда филиал выбран — это сознательно, такие записи не
   * относятся к выбранному филиалу.
   */
  secondary?: {
    column: string
    value: Ref<string | null>
  }
}

export function useRealtimeWatch(table: string, id: Ref<string | null>, handlers: Handlers) {
  const api = useDatabase()
  const column = handlers.column ?? 'id'
  let channel: RealtimeChannel | null = null

  const isConnected = ref(false)
  // Стартуем с true, чтобы пропустить первый SUBSCRIBED (initial connect).
  // Сбрасываем в false на dispose, чтобы новый setup() корректно отработал
  // как «первая подписка» (без фантомного onReconnect).
  let wasConnected = true

  // Generation counter защищает от race при быстрой смене branch: watcher
  // синхронно вызывает dispose() → setup(), несколько setup() уходят в await
  // setupAuth() параллельно. Без epoch'a первый завершивший setup устанавливает
  // channel=A, потом второй затирает channel=B и канал A остаётся подписанным
  // на сервере без ссылки → утечка. Epoch проверяется ПОСЛЕ await: если он
  // устарел, abort'имся и не трогаем channel/wasConnected.
  let epoch = 0

  const dispose = () => {
    epoch++
    if (channel) api.realtime.removeChannel(channel)
    channel = null
    isConnected.value = false
    wasConnected = true
  }

  const setup = async (primaryValue: string, secondaryValue: string | null) => {
    const myEpoch = ++epoch

    await api.realtime.setupAuth()
    if (myEpoch !== epoch) return // устарел — другой setup опередил, аборт

    // ChannelKey включает оба значения — при смене filial канал
    // пересоздаётся (предыдущий dispose() уже отписался от старого).
    const effectiveColumn = secondaryValue && handlers.secondary
      ? handlers.secondary.column
      : column
    const effectiveValue = secondaryValue && handlers.secondary
      ? secondaryValue
      : primaryValue
    const channelKey = secondaryValue && handlers.secondary
      ? `${table}:${primaryValue}:${handlers.secondary.column}=${secondaryValue}`
      : `${table}:${primaryValue}`

    channel = api.realtime.subscribeToTable(
      channelKey,
      table,
      `${effectiveColumn}=eq.${effectiveValue}`,
      {
        ...(handlers.onInsert && { onInsert: ({ new: row }) => handlers.onInsert!(row) }),
        ...(handlers.onUpdate && { onUpdate: ({ new: row }) => handlers.onUpdate!(row) }),
        ...(handlers.onDelete && { onDelete: ({ old: row }) => handlers.onDelete!(row) }),
        onStatus: (connected) => {
          // Если этот канал уже устарел (epoch продвинулся пока он
          // переподключался), статусы игнорируем — onReconnect не дергаем,
          // wasConnected не трогаем чтобы не повлиять на текущий setup.
          if (myEpoch !== epoch) return
          isConnected.value = connected
          if (connected && !wasConnected) {
            handlers.onReconnect?.()
          }
          wasConnected = connected
        },
      },
    )
  }

  // Watcher с двумя источниками: при изменении любого из них канал
  // переподписывается. Без secondary — поведение как было.
  const sources = handlers.secondary
    ? () => [id.value, handlers.secondary!.value.value] as const
    : () => [id.value, null] as const

  watch(sources, ([primary, secondary]) => {
    dispose()
    if (primary) setup(primary, secondary)
  }, { immediate: true })

  if (getCurrentInstance()) onUnmounted(dispose)

  return { dispose, isConnected }
}
