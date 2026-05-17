import { defineEventHandler, readBody, createError } from 'h3'
import { useRuntimeConfig } from '#imports'
import { getServerSupabase } from '../../utils/supabase'

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

// Привязываем поиск к координатам первого филиала тенанта (радиус 50 км). Сейчас
// продукт ориентирован на работу в одном городе, и без гео-фильтра подсказки
// засоряются однофамильными улицами из других регионов. locations_geo в DaData —
// жёсткий фильтр, поэтому если у тенанта ещё нет филиала с координатами,
// фильтр не применяется (на онбординге это первый ввод адреса).
export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const tenantId = String(body.tenantId ?? '').trim()

  if (!tenantId) throw createError({ statusCode: 400, message: 'tenantId is required' })

  const query = String(body.query ?? '').trim()

  if (!query || query.length < 3) return { suggestions: [] }

  const apiKey = useRuntimeConfig().dadataApiKey

  if (!apiKey) throw createError({ statusCode: 500, message: 'DaData API key not configured' })

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
