import { defineEventHandler, createError, readBody, getRouterParam } from 'h3'
import { getAdminClient } from '../../utils/adminClient'

const VALID_BUSINESS_TYPES = ['retail', 'services'] as const

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  if (!id) throw createError({ statusCode: 400, message: 'Missing plan id' })

  const body = await readBody(event)

  if (body.business_type !== undefined && !VALID_BUSINESS_TYPES.includes(body.business_type)) {
    throw createError({ statusCode: 400, message: `Invalid business_type: must be one of ${VALID_BUSINESS_TYPES.join(', ')}` })
  }
  if (typeof body.price === 'number' && body.price < 0) {
    throw createError({ statusCode: 400, message: 'Price must be >= 0' })
  }

  const supabase = getAdminClient()

  const update: Record<string, unknown> = {}

  if (body.name !== undefined) update.name = body.name
  if (body.description !== undefined) update.description = body.description
  if (body.price !== undefined) update.price = body.price
  if (body.sort_order !== undefined) update.sort_order = body.sort_order
  if (body.is_active !== undefined) update.is_active = body.is_active
  if (body.features !== undefined) update.features = body.features
  if (body.business_type !== undefined) update.business_type = body.business_type
  if (body.badge !== undefined) update.badge = body.badge
  if (body.is_featured !== undefined) update.is_featured = body.is_featured

  const { data, error } = await supabase
    .from('plans')
    .update(update)
    .eq('id', id)
    .select()
    .single()

  if (error) throw createError({ statusCode: 500, message: error.message })

  return data
})
