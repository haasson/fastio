import { defineEventHandler, createError, getRouterParam } from 'h3'
import { getAdminClient } from '../../utils/adminClient'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  if (!id) throw createError({ statusCode: 400, message: 'Missing ticket id' })

  const supabase = getAdminClient()

  const { data: ticket, error } = await supabase
    .from('support_tickets')
    .select('*, tenants(name)')
    .eq('id', id)
    .single()

  if (error) throw createError({ statusCode: 500, message: error.message })
  if (!ticket) throw createError({ statusCode: 404, message: 'Ticket not found' })

  const tenant = ticket.tenants as { name: string } | null

  return {
    id: ticket.id,
    tenantId: ticket.tenant_id,
    tenantName: tenant?.name ?? '—',
    subject: ticket.subject,
    status: ticket.status,
    createdAt: ticket.created_at,
    updatedAt: ticket.updated_at,
  }
})
