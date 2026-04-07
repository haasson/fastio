import { defineEventHandler, createError } from 'h3'
import { getAdminClient } from '../../utils/adminClient'

export default defineEventHandler(async () => {
  // Returns number of tickets (not individual messages) with unread tenant messages
  const supabase = getAdminClient()

  const { data: tickets, error } = await supabase
    .from('support_tickets')
    .select('id, support_last_seen_at, support_messages(id, sender_type, created_at)')
    .in('status', ['open', 'waiting_for_reply'])

  if (error) throw createError({ statusCode: 500, message: error.message })

  let count = 0

  for (const ticket of tickets ?? []) {
    const hasUnread = (ticket.support_messages ?? []).some(
      (m) => m.sender_type === 'tenant'
        && (!ticket.support_last_seen_at || new Date(m.created_at) > new Date(ticket.support_last_seen_at)),
    )

    if (hasUnread) count++
  }

  return { count }
})
