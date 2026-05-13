import { defineEventHandler, readBody, createError } from 'h3'
import { getServerSupabase } from '../../utils/supabase'
import { requireMemberOfTenant } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const tenantId = String(body.tenantId ?? '').trim()
  const code = String(body.code ?? '').trim()
  const subtotal = Number(body.subtotal ?? 0)
  const scheduledAt = typeof body.scheduledAt === 'string' && body.scheduledAt ? body.scheduledAt : null

  if (!tenantId || !code) throw createError({ statusCode: 400, message: 'tenantId и code обязательны' })
  if (!Number.isFinite(subtotal) || subtotal < 0) throw createError({ statusCode: 400 })

  await requireMemberOfTenant(event, tenantId)

  const supabase = getServerSupabase()
  const { data, error } = await supabase.rpc('check_promo_code', {
    p_tenant_id: tenantId,
    p_code: code,
    p_subtotal: subtotal,
    ...(scheduledAt && { p_delivery_time: scheduledAt }),
  })

  if (error) {
    console.error('[promo/check]', error)
    throw createError({ statusCode: 500 })
  }

  const result = data as { valid: boolean; discount_type?: string; discount_value?: number; min_order_amount?: number } | null

  if (!result?.valid) {
    const message = result?.min_order_amount != null
      ? `Минимальная сумма заказа — ${result.min_order_amount} ₽`
      : 'Промокод недействителен'

    return { valid: false, discountAmount: 0, error: message }
  }

  const discountAmount = result.discount_type === 'percent'
    ? Math.round(subtotal * Number(result.discount_value) / 100)
    : Math.min(Number(result.discount_value), subtotal)

  return { valid: true, discountAmount }
})
