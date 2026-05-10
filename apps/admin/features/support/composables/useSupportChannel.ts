import { watch, type Ref } from 'vue'
import type { SupportTicket } from '@fastio/shared'
import { useDatabase } from '~/shared/data/useDatabase'
import { useRealtimeWatch } from '~/shared/data/useRealtimeWatch'
import { useUnreadSupportCounter } from './useUnreadSupportCounter'

type Handler<T> = (payload: T) => void

// Module-level — shared across the app
const ticketUpdateHandlers = new Set<Handler<SupportTicket>>()

export const supportEvents = {
  onTicketUpdate(handler: Handler<SupportTicket>) {
    ticketUpdateHandlers.add(handler)

    return () => ticketUpdateHandlers.delete(handler)
  },
}

/**
 * Call ONCE in layout. Creates realtime channels for support tickets & messages.
 */
export function useSupportChannel(tenantId: Ref<string | null>) {
  const { support } = useDatabase()
  const { set } = useUnreadSupportCounter()

  const refreshUnread = async () => {
    const tid = tenantId.value

    if (!tid) return
    const count = await support.getUnreadCount(tid)

    set(count)
  }

  // Ticket changes (status, last_seen, etc.)
  useRealtimeWatch('support_tickets', tenantId, {
    column: 'tenant_id',
    onUpdate: async (row) => {
      const id = (row as { id: string }).id

      try {
        const ticket = await support.getTicket(id)

        ticketUpdateHandlers.forEach((h) => h(ticket))
      } catch (err) {
        console.error('[useSupportChannel] failed to fetch updated ticket', err)
      }

      refreshUnread()
    },
    onInsert: () => {
      refreshUnread()
    },
  })

  // New messages — listen via ticket_id won't work because tenant_id is on tickets.
  // Instead, we watch support_messages by ticket's tenant link.
  // Since useRealtimeWatch filters by a single column, and messages don't have tenant_id,
  // we handle message detection through ticket updates triggered by the DB trigger.
  // The on_support_message_insert trigger updates the ticket's updated_at,
  // which fires the onUpdate handler above.

  // Initial + re-load on tenant switch
  watch(tenantId, (tid) => {
    if (tid) refreshUnread()
  }, { immediate: true })
}
