import type { SupabaseClient } from '@supabase/supabase-js'
import type { SupportTicket, SupportMessage, SupportSenderType } from '@fastio/shared'
import { query } from '~/shared/utils/query'
import { optimizeImage } from '~/shared/utils/imageOptimize'

// ── Row types (snake_case from DB) ──────────────────────────

type TicketRow = {
  id: string
  tenant_id: string
  subject: string
  status: string
  created_by: string
  tenant_last_seen_at: string | null
  support_last_seen_at: string | null
  created_at: string
  updated_at: string
  support_messages?: MessageRow[]
}

type MessageRow = {
  id: string
  ticket_id: string
  sender_type: string
  sender_id: string
  body: string
  image_urls: string[] | null
  created_at: string
}

// ── Mappers ─────────────────────────────────────────────────

const mapMessage = (row: MessageRow): SupportMessage => ({
  id: row.id,
  ticketId: row.ticket_id,
  senderType: row.sender_type as SupportSenderType,
  senderId: row.sender_id,
  body: row.body,
  imageUrls: row.image_urls,
  createdAt: row.created_at,
})

const mapTicket = (row: TicketRow): SupportTicket => {
  const messages = row.support_messages ?? []
  const tenantSeen = row.tenant_last_seen_at ? new Date(row.tenant_last_seen_at).getTime() : 0

  const unreadCount = messages.filter(
    (m) => m.sender_type === 'support' && new Date(m.created_at).getTime() > tenantSeen,
  ).length

  const last = messages.length ? messages[messages.length - 1] : null

  return {
    id: row.id,
    tenantId: row.tenant_id,
    subject: row.subject,
    status: row.status as SupportTicket['status'],
    createdBy: row.created_by,
    tenantLastSeenAt: row.tenant_last_seen_at,
    supportLastSeenAt: row.support_last_seen_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    unreadCount,
    lastMessage: last?.body,
    lastMessageAt: last?.created_at,
  }
}

// ── API ─────────────────────────────────────────────────────

const TICKET_SELECT = '*, support_messages(*)' as const

export const supportApi = {
  async listTickets(sb: SupabaseClient, tenantId: string): Promise<SupportTicket[]> {
    const rows = await query(
      sb.from('support_tickets')
        .select(TICKET_SELECT)
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false }),
    )

    return (rows as TicketRow[]).map(mapTicket)
  },

  async getTicket(sb: SupabaseClient, ticketId: string): Promise<SupportTicket> {
    const row = await query(
      sb.from('support_tickets')
        .select(TICKET_SELECT)
        .eq('id', ticketId)
        .single(),
    )

    return mapTicket(row as TicketRow)
  },

  async createTicket(
    sb: SupabaseClient,
    tenantId: string,
    subject: string,
  ): Promise<SupportTicket> {
    const { data: { user } } = await sb.auth.getUser()

    const row = await query(
      sb.from('support_tickets')
        .insert({
          tenant_id: tenantId,
          subject,
          created_by: user!.id,
        })
        .select(TICKET_SELECT)
        .single(),
    )

    return mapTicket(row as TicketRow)
  },

  async listMessages(sb: SupabaseClient, ticketId: string): Promise<SupportMessage[]> {
    const rows = await query(
      sb.from('support_messages')
        .select('*')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true }),
    )

    return (rows as MessageRow[]).map(mapMessage)
  },

  async sendMessage(
    sb: SupabaseClient,
    ticketId: string,
    body: string,
    imageUrls?: string[],
  ): Promise<SupportMessage> {
    const { data: { user } } = await sb.auth.getUser()

    const row = await query(
      sb.from('support_messages')
        .insert({
          ticket_id: ticketId,
          sender_type: 'tenant',
          sender_id: user!.id,
          body,
          image_urls: imageUrls ?? null,
        })
        .select()
        .single(),
    )

    return mapMessage(row as MessageRow)
  },

  async markSeen(sb: SupabaseClient, ticketId: string): Promise<void> {
    await query(
      sb.from('support_tickets')
        .update({ tenant_last_seen_at: new Date().toISOString() })
        .eq('id', ticketId),
    )
  },

  async closeTicket(sb: SupabaseClient, ticketId: string): Promise<void> {
    await query(
      sb.from('support_tickets')
        .update({ status: 'resolved' })
        .eq('id', ticketId),
    )
  },

  async hasOpenTickets(sb: SupabaseClient, tenantId: string): Promise<boolean> {
    const rows = await query(
      sb.from('support_tickets')
        .select('id')
        .eq('tenant_id', tenantId)
        .in('status', ['open', 'waiting_for_reply'])
        .limit(1),
    )

    return (rows as { id: string }[]).length > 0
  },

  async uploadImage(
    sb: SupabaseClient,
    tenantId: string,
    ticketId: string,
    file: File,
  ): Promise<string> {
    const blob = await optimizeImage(file)
    const uuid = crypto.randomUUID()
    const path = `${tenantId}/${ticketId}/${uuid}.webp`

    await query(sb.storage.from('support-attachments').upload(path, blob, { contentType: 'image/webp' }))

    const { publicUrl } = sb.storage.from('support-attachments').getPublicUrl(path).data

    return publicUrl
  },

  async getUnreadCount(sb: SupabaseClient, tenantId: string): Promise<number> {
    const { data, error } = await sb.rpc('get_tenant_unread_support_count', { p_tenant_id: tenantId })

    if (error) throw error

    return data ?? 0
  },
}
