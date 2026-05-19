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

  const dispose = () => {
    if (channel) api.realtime.removeChannel(channel)
    channel = null
    isConnected.value = false
    wasConnected = true
  }

  const setup = async (value: string) => {
    await api.realtime.setupAuth()
    channel = api.realtime.subscribeToTable(`${table}:${value}`, table, `${column}=eq.${value}`, {
      ...(handlers.onInsert && { onInsert: ({ new: row }) => handlers.onInsert!(row) }),
      ...(handlers.onUpdate && { onUpdate: ({ new: row }) => handlers.onUpdate!(row) }),
      ...(handlers.onDelete && { onDelete: ({ old: row }) => handlers.onDelete!(row) }),
      onStatus: (connected) => {
        isConnected.value = connected
        if (connected && !wasConnected) {
          handlers.onReconnect?.()
        }
        wasConnected = connected
      },
    })
  }

  watch(id, (value) => {
    dispose()
    if (value) setup(value)
  }, { immediate: true })

  if (getCurrentInstance()) onUnmounted(dispose)

  return { dispose, isConnected }
}
