import { createRateLimiter } from '@fastio/shared'
import { getTenantDb } from '../../utils/tenantDb'
import { getClientIp } from '../../utils/clientIp'
import { reportError } from '~/shared/utils/reportError'
import type { SupabaseClient } from '@supabase/supabase-js'

const perMinuteLimit = createRateLimiter(20, 60_000)
const per12hLimit = createRateLimiter(250, 12 * 60 * 60 * 1000)

const tenantCoordsCache = new Map<string, { lat: number; lon: number } | null>()

async function getTenantCoords(
  tenantId: string,
  // safe: querying branches by tenant_id using service_role client
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
): Promise<{ lat: number; lon: number } | null> {
  if (tenantCoordsCache.has(tenantId)) return tenantCoordsCache.get(tenantId)!

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

  // null НЕ кэшируем (тот же паттерн что admin после PREPROD-004). Если филиал
  // тенанта появится / у него обновятся координаты — следующий запрос подтянет
  // их вместо вечной null-записи в этом nitro-инстансе. Положительный coords
  // кэшируется бессрочно — координаты филиалов меняются редко, рестарт деплоя
  // сбросит кэш.
  if (coords) tenantCoordsCache.set(tenantId, coords)

  return coords
}

export default defineEventHandler(async (event) => {
  const db = getTenantDb(event)

  const ip = getClientIp(event)
  const key = `${db.tenantId}:${ip}`
  if (!perMinuteLimit.check(key) || !per12hLimit.check(key)) {
    throw createError({ statusCode: 429, message: 'Слишком много запросов' })
  }

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
