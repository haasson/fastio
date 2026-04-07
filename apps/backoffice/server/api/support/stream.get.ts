import { defineEventHandler, createError, getQuery, createEventStream } from 'h3'
import { getAdminClient } from '../../utils/adminClient'

export default defineEventHandler(async (event) => {
  const { ticketId } = getQuery(event) as { ticketId?: string }

  if (!ticketId) throw createError({ statusCode: 400, message: 'Missing ticketId' })

  const eventStream = createEventStream(event)
  const sb = getAdminClient()

  // Unique channel name per connection to avoid conflicts on shared client
  const channel = sb.channel(`bo-ticket-${ticketId}-${Date.now()}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'support_messages', filter: `ticket_id=eq.${ticketId}` },
      () => { eventStream.push({ event: 'message', data: '' }) },
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'support_tickets', filter: `id=eq.${ticketId}` },
      () => { eventStream.push({ event: 'ticket', data: '' }) },
    )
    .subscribe()

  eventStream.onClosed(async () => {
    await sb.removeChannel(channel)
  })

  return eventStream.send()
})
