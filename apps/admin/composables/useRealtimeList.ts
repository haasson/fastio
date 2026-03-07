import { ref, watch, onUnmounted } from 'vue'
import { useNuxtApp } from '#imports'
import type { RealtimeChannel } from '@supabase/supabase-js'

type Options<T extends { id: string }> = {
  /** Реактивный ключ канала. null = подписка неактивна */
  channelKey: Ref<string | null>
  table: string
  /** Postgres filter для realtime, e.g. tenant_id=eq.xxx */
  filter: Ref<string>
  fetch: () => Promise<T[]>
  mapper: (row: Record<string, unknown>) => T
  /** Если задана — INSERT/UPDATE добавляет/оставляет элемент только если true */
  shouldInclude?: (item: T) => boolean
}

export function useRealtimeList<T extends { id: string }>(options: Options<T>) {
  const { $supabase } = useNuxtApp()
  const items = ref<T[]>([]) as Ref<T[]>
  const loading = ref(false)

  let channel: RealtimeChannel | null = null

  // Добавляет элемент в список, если он проходит фильтр и ещё не присутствует
  const onInsert = ({ new: row }: { new: Record<string, unknown> }) => {
    const item = options.mapper(row)

    if (options.shouldInclude && !options.shouldInclude(item)) return
    if (!items.value.find((i) => i.id === item.id)) items.value.push(item)
  }

  // Обновляет элемент на месте; если он больше не проходит фильтр — удаляет из списка
  const onUpdate = ({ new: row }: { new: Record<string, unknown> }) => {
    const item = options.mapper(row)
    const idx = items.value.findIndex((i) => i.id === item.id)

    if (idx === -1) return

    if (options.shouldInclude && !options.shouldInclude(item)) {
      items.value.splice(idx, 1)
    } else {
      items.value[idx] = item
    }
  }

  // Удаляет элемент по id (фильтр по tenantId не нужен — строка уже удалена на сервере)
  const onDelete = ({ old: row }: { old: { id?: unknown } }) => {
    items.value = items.value.filter((i) => i.id !== row.id)
  }

  const setup = async (key: string, filter: string) => {
    loading.value = true
    items.value = await options.fetch()
    loading.value = false

    const { data: { session } } = await $supabase.auth.getSession()

    if (session?.access_token) $supabase.realtime.setAuth(session.access_token)

    channel = $supabase
      .channel(key)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: options.table, filter }, onInsert)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: options.table, filter }, onUpdate)
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: options.table }, onDelete)
      .subscribe()
  }

  watch(
    [options.channelKey, options.filter],
    ([key, filter]) => {
      channel?.unsubscribe()
      channel = null
      items.value = []

      if (key && filter) setup(key, filter)
    },
    { immediate: true },
  )

  const refresh = async () => {
    loading.value = true
    items.value = await options.fetch()
    loading.value = false
  }

  onUnmounted(() => channel?.unsubscribe())

  return { items, loading, refresh }
}
