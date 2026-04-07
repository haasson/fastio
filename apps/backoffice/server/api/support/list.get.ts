import { defineEventHandler, createError, getQuery } from 'h3'
import { getAdminClient } from '../../utils/adminClient'

type MessageRow = {
  id: string
  sender_type: string
  body: string
  created_at: string
}

type TicketRow = {
  id: string
  tenantId: string
  tenantName: string
  subject: string
  status: string
  createdAt: string
  updatedAt: string
  unreadCount: number
  lastMessage: string | null
  lastMessageAt: string | null
}

export default defineEventHandler(async (event): Promise<TicketRow[]> => {
  const supabase = getAdminClient()
  const { status } = getQuery(event) as { status?: string }

  let query = supabase
    .from('support_tickets')
    .select('*, support_messages(id, sender_type, body, created_at), tenants(name)')
    .order('updated_at', { ascending: false })

  if (status && status !== 'all') {
    query = query.eq('status', status)
  }

  const { data, error } = await query

  if (error) throw createError({ statusCode: 500, message: error.message })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((ticket: any) => {
    const messages: MessageRow[] = ticket.support_messages ?? []
    const tenant = ticket.tenants as { name: string } | null

    const sorted = [...messages].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    )

    const lastMsg = sorted[0] ?? null

    const unreadCount = messages.filter(
      (m) => m.sender_type === 'tenant'
        && (!ticket.support_last_seen_at || new Date(m.created_at) > new Date(ticket.support_last_seen_at)),
    ).length

    return {
      id: ticket.id,
      tenantId: ticket.tenant_id,
      tenantName: tenant?.name ?? '—',
      subject: ticket.subject,
      status: ticket.status,
      createdAt: ticket.created_at,
      updatedAt: ticket.updated_at,
      unreadCount,
      lastMessage: lastMsg?.body ?? null,
      lastMessageAt: lastMsg?.created_at ?? null,
    }
  })
})
