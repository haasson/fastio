import { defineEventHandler, createError, getRouterParam } from 'h3'
import { getAdminClient } from '../../../utils/adminClient'

type MessageRow = {
  id: string
  ticketId: string
  senderType: string
  senderId: string
  body: string
  imageUrls: string[]
  createdAt: string
}

export default defineEventHandler(async (event): Promise<MessageRow[]> => {
  const id = getRouterParam(event, 'id')

  if (!id) throw createError({ statusCode: 400, message: 'Missing ticket id' })

  const supabase = getAdminClient()

  const { data, error } = await supabase
    .from('support_messages')
    .select('*')
    .eq('ticket_id', id)
    .order('created_at', { ascending: true })

  if (error) throw createError({ statusCode: 500, message: error.message })

  return (data ?? []).map((msg) => ({
    id: msg.id,
    ticketId: msg.ticket_id,
    senderType: msg.sender_type,
    senderId: msg.sender_id,
    body: msg.body,
    imageUrls: msg.image_urls ?? [],
    createdAt: msg.created_at,
  }))
})
