import { defineEventHandler, getQuery, createError, getRequestIP } from 'h3'
import { createRateLimiter } from '@fastio/shared'
import { getAdminClient } from '../utils/adminClient'

const SLUG_MAX_LENGTH = 63
// In-memory limiter: rely на single-instance деплой. См. комментарий в register.post.ts.
const rateLimiter = createRateLimiter(60, 60_000)

export default defineEventHandler(async (event) => {
  const ip = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown'

  if (!rateLimiter.check(ip)) {
    throw createError({ statusCode: 429, message: 'Слишком много запросов' })
  }

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
