import { defineEventHandler, createError, readBody } from 'h3'
import { getAdminClient } from '../utils/adminClient'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  if (!body.key || typeof body.key !== 'string' || !/^[a-z0-9_-]+$/.test(body.key) || body.key.length > 50) {
    throw createError({ statusCode: 400, message: 'Invalid plan key: only lowercase letters, digits, hyphens and underscores (max 50 chars)' })
  }
  if (typeof body.price === 'number' && body.price < 0) {
    throw createError({ statusCode: 400, message: 'Price must be >= 0' })
  }

  const supabase = getAdminClient()

  const { data, error } = await supabase
    .from('plans')
    .insert({
      key: body.key,
      name: body.name,
      description: body.description ?? '',
      price: body.price ?? 0,
      sort_order: body.sort_order ?? 0,
      is_active: body.is_active ?? true,
    })
    .select()
    .single()

  if (error) throw createError({ statusCode: 500, message: error.message })

  return data
})
