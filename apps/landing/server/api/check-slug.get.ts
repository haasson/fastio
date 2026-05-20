import { defineEventHandler, getQuery, createError } from 'h3'
import { getAdminClient } from '../utils/adminClient'
import { getClientIp } from '@fastio/shared/server'
import { enforceRateLimit } from '../utils/enforceRateLimit'

const SLUG_MAX_LENGTH = 63

export default defineEventHandler(async (event) => {
  const ip = getClientIp(event)

  await enforceRateLimit(
    [{ key: `landing-check-slug:ip:${ip}`, max: 60, windowSeconds: 60 }],
    'Слишком много запросов',
  )

  const { slug } = getQuery(event) as { slug?: string }

  if (!slug || typeof slug !== 'string') {
    throw createError({ statusCode: 400, message: 'slug is required' })
  }

  const normalizedSlug = slug.toLowerCase()

  if (normalizedSlug.length > SLUG_MAX_LENGTH || !/^[a-z0-9-]+$/.test(normalizedSlug)) {
    return { available: false, reason: 'format' }
  }

  const supabase = getAdminClient()
  const { data } = await supabase.from('tenants').select('id').eq('slug', normalizedSlug).maybeSingle()

  return { available: !data }
})
