import { defineEventHandler, createError, getRouterParam } from 'h3'
import { getAdminClient } from '../../../utils/adminClient'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  if (!id) throw createError({ statusCode: 400, message: 'Missing ticket id' })

  const supabase = getAdminClient()

  const { error } = await supabase
    .from('support_tickets')
    .update({ support_last_seen_at: new Date().toISOString() })
    .eq('id', id)

  if (error) throw createError({ statusCode: 500, message: error.message })

  return { ok: true }
})
