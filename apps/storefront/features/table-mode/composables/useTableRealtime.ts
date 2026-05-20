import { onMounted, onUnmounted, ref } from 'vue'
import { useSupabaseClient } from '~/shared/composables/useSupabaseClient'

/**
 * PREPROD-226: подписка на realtime-изменения чека стола (order_items +
 * kitchen_queue) с поллинг-fallback'ом только когда WS оборван.
 *
 * Раньше поллинг каждые 30s ехал параллельно с realtime — double-fetch
 * без пользы. Теперь:
 *   - пока WS подключён (status === 'SUBSCRIBED') — `isConnected = true`,
 *     поллинг выключен; апдейты приходят push'ом через канал
 *   - на отвале WS (CHANNEL_ERROR / TIMED_OUT / CLOSED) — поллинг
 *     включается, чтобы гость не сидел со stale чеком
 *   - на reconnect — один catch-up `onChange()` + останов поллинга
 *     (паттерн взят из `apps/admin/shared/data/useRealtimeWatch.ts`)
 */
const POLL_INTERVAL_MS = 30_000

export function useTableRealtime(tenantId: string, onChange: () => void) {
  const supabase = useSupabaseClient()
  let channel: ReturnType<typeof supabase.channel> | null = null
  let poll: ReturnType<typeof setInterval> | null = null

  const isConnected = ref(false)
  // Стартуем с true чтобы пропустить первый SUBSCRIBED (initial connect) —
  // изначальная загрузка идёт через consumer (`loadCheck()` в page),
  // catch-up не нужен. Сбрасывается в false на dispose, см. ниже.
  let wasConnected = true

  const startPolling = () => {
    if (poll) return
    poll = setInterval(onChange, POLL_INTERVAL_MS)
  }

  const stopPolling = () => {
    if (poll) {
      clearInterval(poll)
      poll = null
    }
  }

  onMounted(() => {
    channel = supabase
      .channel('table-check')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items', filter: `tenant_id=eq.${tenantId}` }, () => onChange())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'kitchen_queue', filter: `tenant_id=eq.${tenantId}` }, () => onChange())
      .subscribe((status) => {
        // Supabase шлёт SUBSCRIBED при первом коннекте/reconnect,
        // CHANNEL_ERROR/TIMED_OUT/CLOSED при отвале.
        const connected = status === 'SUBSCRIBED'
        isConnected.value = connected

        if (connected) {
          // Reconnect (был оборван, теперь снова жив) — догнать апдейты
          // которые могли проехать мимо канала, и заглушить поллинг.
          if (!wasConnected) {
            onChange()
          }
          stopPolling()
        } else {
          // Канал упал — поднять поллинг как safety-net. Если он уже
          // запущен — startPolling это no-op.
          startPolling()
        }

        wasConnected = connected
      })
  })

  onUnmounted(() => {
    stopPolling()
    if (channel) supabase.removeChannel(channel)
    isConnected.value = false
    wasConnected = true
  })

  return { isConnected }
}
