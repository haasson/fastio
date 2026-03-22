import { createRateLimiter } from '../../utils/rateLimit'
import { getServerSupabase } from '../../utils/supabase'

const dadataRateLimiter = createRateLimiter(20, 60_000)

const tenantCoordsCache = new Map<string, { lat: number; lon: number } | null>()

async function getTenantCoords(tenantId: string): Promise<{ lat: number; lon: number } | null> {
  if (tenantCoordsCache.has(tenantId)) return tenantCoordsCache.get(tenantId)!

  const supabase = getServerSupabase()
  const { data } = await supabase
    .from('branches')
    .select('latitude, longitude')
    .eq('tenant_id', tenantId)
    .not('latitude', 'is', null)
    .limit(1)
    .maybeSingle()

  const coords = data?.latitude && data?.longitude
    ? { lat: data.latitude as number, lon: data.longitude as number }
    : null

  tenantCoordsCache.set(tenantId, coords)
  return coords
}

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

  const coords = await getTenantCoords(tenantId)

  const dadataBody: Record<string, unknown> = { query, count: 5 }
  if (coords) {
    dadataBody.locations_geo = [{ lat: coords.lat, lon: coords.lon, radius_meters: 50000 }]
  }

  const res = await $fetch('https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/address', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Token ${apiKey}`,
    },
    body: dadataBody,
  })

  return res
})
