import { defineEventHandler, readBody, createError } from 'h3'
import { useRuntimeConfig } from '#imports'
import { getServerSupabase } from '../../utils/supabase'
import { requireMemberOfTenant } from '../../utils/auth'
import { reportError } from '~/shared/utils/reportError'

const tenantCoordsCache = new Map<string, { lat: number; lon: number } | null>()

async function getTenantCoords(tenantId: string): Promise<{ lat: number; lon: number } | null> {
  if (tenantCoordsCache.has(tenantId)) return tenantCoordsCache.get(tenantId)!

  const supabase = getServerSupabase()
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

  // null НЕ кэшируем: на онбординге первый ввод адреса дёргает getTenantCoords
  // когда филиала ещё нет (юзер его и создаёт через DaData). Если закэшировать
  // null — после успешного создания филиала тот же nitro-инстанс будет помнить
  // null до рестарта, и фильтр locations_geo не применится ни на этой сессии,
  // ни на следующих юзерских запросах (например адрес доставки в заказе).
  if (coords) tenantCoordsCache.set(tenantId, coords)

  return coords
}

// Привязываем поиск к координатам первого филиала тенанта (радиус 50 км). Сейчас
// продукт ориентирован на работу в одном городе, и без гео-фильтра подсказки
// засоряются однофамильными улицами из других регионов. locations_geo в DaData —
// жёсткий фильтр, поэтому если у тенанта ещё нет филиала с координатами,
// фильтр не применяется (на онбординге это первый ввод адреса).
export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const tenantId = String(body.tenantId ?? '').trim()

  if (!tenantId) throw createError({ statusCode: 400, message: 'tenantId is required' })

  // До этого endpoint был открыт публично — любой с интернета мог сливать нашу
  // платную квоту DaData (а заодно читать tenantCoordsCache подменой tenantId).
  // requireMemberOfTenant проверяет JWT + членство в tenant_members + blocked_until.
  const { userId } = await requireMemberOfTenant(event, tenantId)

  const query = String(body.query ?? '').trim()

  // Короткий запрос — short-circuit ДО rate-limit. Иначе каждая буква ввода
  // (до debounce-cutoff'а в 3 символа) съедала бы единицу лимита, хотя DaData
  // мы для них и не дёргаем.
  if (!query || query.length < 3) return { suggestions: [] }

  // Durable rate-limit: 30 запросов/мин на пару (user, tenant). Onboarding ввод
  // адреса с debounce 300мс даёт ~3 запроса/сек = 180/мин при потоковом наборе,
  // но фактически юзер вводит постепенно с паузами → реально 5-10/мин. 30 — c запасом.
  // consume_rate_limit (миграция 264) — atomic upsert, horizontally safe в отличие
  // от in-memory createRateLimiter (deprecated, не выживает рестарт + multi-instance).
  const sb = getServerSupabase()
  const { data: allowed, error: rlError } = await sb.rpc('consume_rate_limit', {
    _key: `dadata:${userId}:${tenantId}`,
    _max: 30,
    _window_seconds: 60,
  })

  if (rlError) {
    reportError(rlError)
    throw createError({ statusCode: 500, message: 'Rate limit check failed' })
  }
  if (!allowed) throw createError({ statusCode: 429, message: 'Too many requests' })

  const apiKey = useRuntimeConfig().dadataApiKey

  if (!apiKey) {
    reportError(new Error('[dadata] NUXT_DADATA_API_KEY not configured'))
    throw createError({ statusCode: 500, message: 'DaData API key not configured' })
  }

  const level = body.level === 'city' ? 'city' : 'address'

  const dadataBody: Record<string, unknown> = { query, count: 5 }

  if (level === 'city') {
    // Показываем только города/нас. пункты — без улиц/домов. Используется
    // на онбординге для showcase-планов где адресная точность не нужна.
    dadataBody.from_bound = { value: 'city' }
    dadataBody.to_bound = { value: 'settlement' }
  } else {
    // Полный адрес: привязываем к координатам первого филиала тенанта (радиус
    // 50 км), чтобы не сорить однофамильными улицами из других регионов.
    const coords = await getTenantCoords(tenantId)

    if (coords) {
      dadataBody.locations_geo = [{ lat: coords.lat, lon: coords.lon, radius_meters: 50000 }]
    }
  }

  try {
    return await $fetch<unknown>('https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/address', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Token ${apiKey}`,
      },
      body: dadataBody,
    })
  } catch (e) {
    // DaData transient (5xx, network timeout, DNS) — отдаём 503, чтобы фронт
    // не паниковал в Sentry и не показывал юзеру "Internal server error".
    // Composable отрендерит пустые suggestions, юзер сможет продолжить ввод.
    reportError(new Error(`[dadata] proxy fetch failed: ${(e as Error).message}`))
    throw createError({ statusCode: 503, message: 'Address suggestions temporarily unavailable' })
  }
})
