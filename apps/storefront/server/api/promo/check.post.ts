import { getTenantDb } from '../../utils/tenantDb'
import { getClientIp } from '../../utils/clientIp'
import { enforceRateLimit } from '../../utils/enforceRateLimit'

export default defineEventHandler(async (event) => {
  const db = getTenantDb(event)

  const ip = getClientIp(event)
  await enforceRateLimit(
    [{ key: `promo-check:tenant-ip:${db.tenantId}:${ip}`, max: 10, windowSeconds: 60 }],
    'Слишком много запросов. Попробуйте позже.',
  )

  const body = await readBody(event)
  const code = String(body.code ?? '').trim()
  const subtotal = Number(body.subtotal ?? 0)
  const scheduledAt = typeof body.scheduledAt === 'string' && body.scheduledAt ? body.scheduledAt : null

  if (!code) throw createError({ statusCode: 400, message: 'Промокод обязателен' })
  if (!Number.isFinite(subtotal) || subtotal < 0) {
    throw createError({ statusCode: 400, message: 'Некорректная сумма заказа' })
  }

  const { data, error } = await db.raw.rpc('check_promo_code', {
    p_tenant_id: db.tenantId,
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
