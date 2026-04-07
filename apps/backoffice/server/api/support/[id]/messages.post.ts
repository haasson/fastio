import { defineEventHandler, createError, getRouterParam, readBody } from 'h3'
import { getAdminClient } from '../../../utils/adminClient'

const SUPPORT_SENDER_ID = '00000000-0000-0000-0000-000000000000'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  if (!id) throw createError({ statusCode: 400, message: 'Missing ticket id' })

  const { body } = await readBody<{ body: string }>(event)

  if (!body?.trim()) throw createError({ statusCode: 400, message: 'Message body is required' })

  const supabase = getAdminClient()

  const { data, error } = await supabase
    .from('support_messages')
    .insert({
      ticket_id: id,
      sender_type: 'support',
      sender_id: SUPPORT_SENDER_ID,
      body: body.trim(),
    })
    .select()
    .single()

  if (error) throw createError({ statusCode: 500, message: error.message })

  return data
})
