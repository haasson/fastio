import { createRateLimiter } from '../../utils/rateLimit'

const dadataRateLimiter = createRateLimiter(20, 60_000)

export default defineEventHandler(async (event) => {
  const tenantId = event.context.tenantId as string | undefined
  if (!tenantId) throw createError({ statusCode: 404 })

  const ip = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown'
  if (!dadataRateLimiter.check(ip)) {
    throw createError({ statusCode: 429, message: 'Слишком много запросов' })
  }

  const body = await readBody(event)
  const query = String(body.query ?? '').trim()
  if (!query || query.length < 3) return { suggestions: [] }

  const apiKey = useRuntimeConfig().dadataApiKey
  if (!apiKey) throw createError({ statusCode: 500, message: 'DaData API key not configured' })

  const res = await $fetch('https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/address', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Token ${apiKey}`,
    },
    body: { query, count: 5 },
  })

  return res
})
