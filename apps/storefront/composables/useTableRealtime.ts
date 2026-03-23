import { onMounted, onUnmounted } from 'vue'
import { useSupabaseClient } from '~/composables/useSupabaseClient'

export function useTableRealtime(tenantId: string, onChange: () => void) {
  const supabase = useSupabaseClient()
  let channel: ReturnType<typeof supabase.channel> | null = null
  let poll: ReturnType<typeof setInterval> | null = null

  onMounted(() => {
    channel = supabase
      .channel('table-check')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, () => onChange())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'kitchen_queue', filter: `tenant_id=eq.${tenantId}` }, () => onChange())
      .subscribe()

    poll = setInterval(onChange, 30_000)
  })

  onUnmounted(() => {
    if (poll) clearInterval(poll)
    if (channel) supabase.removeChannel(channel)
  })
}
