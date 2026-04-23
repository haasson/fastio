import { defineEventHandler, createError, readBody } from 'h3'
import { getAdminClient } from '../utils/adminClient'

const VALID_BUSINESS_TYPES = ['retail', 'services'] as const

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  if (!body.key || typeof body.key !== 'string' || !/^[a-z0-9_-]+$/.test(body.key) || body.key.length > 50) {
    throw createError({ statusCode: 400, message: 'Invalid plan key: only lowercase letters, digits, hyphens and underscores (max 50 chars)' })
  }
  if (typeof body.price === 'number' && body.price < 0) {
    throw createError({ statusCode: 400, message: 'Price must be >= 0' })
  }

  const businessType = body.business_type ?? 'retail'

  if (!VALID_BUSINESS_TYPES.includes(businessType)) {
    throw createError({ statusCode: 400, message: `Invalid business_type: must be one of ${VALID_BUSINESS_TYPES.join(', ')}` })
  }

  const supabase = getAdminClient()

  const { data, error } = await supabase
    .from('plans')
    .insert({
      key: body.key,
      business_type: businessType,
      name: body.name,
      description: body.description ?? '',
      price: body.price ?? 0,
      sort_order: body.sort_order ?? 0,
      is_active: body.is_active ?? true,
      features: body.features ?? {},
      badge: body.badge ?? null,
      is_featured: body.is_featured ?? false,
    })
    .select()
    .single()

  if (error) throw createError({ statusCode: 500, message: error.message })

  return data
})
