import { getTenantDb } from '../../utils/tenantDb'
import { getClientIp } from '@fastio/shared/server'
import { enforceRateLimit } from '../../utils/enforceRateLimit'
import { reportError } from '@fastio/shared/observability'
import { LRUCache } from 'lru-cache'
import type { SupabaseClient } from '@supabase/supabase-js'

// PREPROD-213: TTL вместо unbounded Map. Если админ обновляет адрес филиала
// (через admin app), stale-координаты на этом nitro-инстансе протухнут за час
// сами по себе — без realtime-подписки на branches.
const tenantCoordsCache = new LRUCache<string, { lat: number; lon: number }>({
  max: 1000,
  ttl: 60 * 60 * 1000, // 1 час
})

async function getTenantCoords(
  tenantId: string,
  // safe: querying branches by tenant_id using service_role client
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
): Promise<{ lat: number; lon: number } | null> {
  const cached = tenantCoordsCache.get(tenantId)
  if (cached) return cached

  const { data, error } = await supabase
    .from('branches')
    .select('latitude, longitude')
    .eq('tenant_id', tenantId)
    .not('latitude', 'is', null)
    .limit(1)
    .maybeSingle()

  if (error) {
    reportError(error)

    return null // не кэшируем, пусть следующий запрос попробует снова
  }

  const coords = data?.latitude && data?.longitude
    ? { lat: data.latitude as number, lon: data.longitude as number }
    : null

  // null НЕ кэшируем (тот же паттерн что admin после PREPROD-004). Положительный
  // coords кэшируется на 1 час — после смены адреса филиала stale исчезнет сам.
  if (coords) tenantCoordsCache.set(tenantId, coords)

  return coords
}

export default defineEventHandler(async (event) => {
  const db = getTenantDb(event)

  const ip = getClientIp(event)
  const scope = `tenant-ip:${db.tenantId}:${ip}`
  await enforceRateLimit(
    [
      { key: `dadata:1m:${scope}`, max: 20, windowSeconds: 60 },
      { key: `dadata:12h:${scope}`, max: 250, windowSeconds: 12 * 60 * 60 },
    ],
    'Слишком много запросов',
  )

  const body = await readBody(event)
  const query = String(body.query ?? '').trim()
  if (!query || query.length < 3) return { suggestions: [] }

  const apiKey = useRuntimeConfig().dadataApiKey
  if (!apiKey) throw createError({ statusCode: 500, message: 'DaData API key not configured' })

  const coords = await getTenantCoords(db.tenantId, db.raw)

  const dadataBody: Record<string, unknown> = { query, count: 5 }
  if (coords) {
    dadataBody.locations_geo = [{ lat: coords.lat, lon: coords.lon, radius_meters: 50000 }]
  }

  // DaData — вспомогательная фича автодополнения адреса. Если внешний сервис лёг
  // или подвис, не валим весь чекаут/онбординг витрины: возвращаем пустые
  // suggestions (тот же контракт что у success-path), юзер вводит руками.
  // Timeout 5s защищает Nitro-воркер от зависших соединений (PREPROD-010).
  try {
    const res = await $fetch<{ suggestions?: unknown[] }>(
      'https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/address',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Token ${apiKey}`,
        },
        body: dadataBody,
        timeout: 5000,
      },
    )

    return res
  } catch (e) {
    reportError(new Error(`[dadata-storefront] proxy fetch failed: ${(e as Error).message}`))
    return { suggestions: [] }
  }
})
