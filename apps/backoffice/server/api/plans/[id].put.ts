import { defineEventHandler, createError, readBody, getRouterParam } from 'h3'
import { getAdminClient } from '../../utils/adminClient'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  if (!id) throw createError({ statusCode: 400, message: 'Missing plan id' })

  const body = await readBody(event)
  const supabase = getAdminClient()

  const update: Record<string, unknown> = {}

  if (body.name !== undefined) update.name = body.name
  if (body.description !== undefined) update.description = body.description
  if (body.price !== undefined) update.price = body.price
  if (body.sort_order !== undefined) update.sort_order = body.sort_order
  if (body.is_active !== undefined) update.is_active = body.is_active

  const { data, error } = await supabase
    .from('plans')
    .update(update)
    .eq('id', id)
    .select()
    .single()

  if (error) throw createError({ statusCode: 500, message: error.message })

  return data
})
