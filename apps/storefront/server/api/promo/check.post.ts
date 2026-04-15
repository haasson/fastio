import { getServerSupabase } from '../../utils/supabase'
import { createRateLimiter } from '@fastio/shared'

const promoRateLimiter = createRateLimiter(10, 60_000)

export default defineEventHandler(async (event) => {
  const tenantId = event.context.tenantId as string | undefined
  if (!tenantId) throw createError({ statusCode: 404 })

  const ip = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown'
  if (!promoRateLimiter.check(ip)) {
    throw createError({ statusCode: 429, message: 'Слишком много запросов. Попробуйте позже.' })
  }

  const body = await readBody(event)
  const code = String(body.code ?? '').trim()
  const subtotal = Number(body.subtotal ?? 0)
  const scheduledAt = typeof body.scheduledAt === 'string' && body.scheduledAt ? body.scheduledAt : null

  if (!code) throw createError({ statusCode: 400, message: 'Промокод обязателен' })
  if (!Number.isFinite(subtotal) || subtotal < 0) {
    throw createError({ statusCode: 400, message: 'Некорректная сумма заказа' })
  }

  const supabase = getServerSupabase()

  const { data, error } = await supabase.rpc('check_promo_code', {
    p_tenant_id: tenantId,
    p_code: code,
    p_subtotal: subtotal,
    ...(scheduledAt && { p_delivery_time: scheduledAt }),
  })

  if (error) {
    console.error('[promo check]', error)
    throw createError({ statusCode: 500, message: 'Ошибка проверки промокода' })
  }

  return data
})
