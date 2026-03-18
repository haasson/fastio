import { ref, watch, onUnmounted, getCurrentInstance, type Ref } from 'vue'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { useDatabase } from '~/composables/data/useDatabase'

type Handlers = {
  /** Колонка для фильтра. По умолчанию 'id' */
  column?: string
  onInsert?: (row: Record<string, unknown>) => void
  onUpdate?: (row: Record<string, unknown>) => void
  onDelete?: (row: Record<string, unknown>) => void
}

export function useRealtimeWatch(table: string, id: Ref<string | null>, handlers: Handlers) {
  const api = useDatabase()
  const column = handlers.column ?? 'id'
  let channel: RealtimeChannel | null = null

  const isConnected = ref(false)

  const dispose = () => {
    channel?.unsubscribe()
    channel = null
    isConnected.value = false
  }

  const setup = async (value: string) => {
    await api.realtime.setupAuth()
    channel = api.realtime.subscribeToTable(`${table}:${value}`, table, `${column}=eq.${value}`, {
      ...(handlers.onInsert && { onInsert: ({ new: row }) => handlers.onInsert!(row) }),
      ...(handlers.onUpdate && { onUpdate: ({ new: row }) => handlers.onUpdate!(row) }),
      ...(handlers.onDelete && { onDelete: ({ old: row }) => handlers.onDelete!(row) }),
      onStatus: (connected) => { isConnected.value = connected },
    })
  }

  watch(id, (value) => {
    dispose()
    if (value) setup(value)
  }, { immediate: true })

  if (getCurrentInstance()) onUnmounted(dispose)

  return { dispose, isConnected }
}
