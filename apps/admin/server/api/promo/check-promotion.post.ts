import { defineEventHandler, readBody, createError } from 'h3'
import { formatPrice } from '@fastio/shared'
import { getServerSupabase } from '../../utils/supabase'
import { requireMemberOfTenant } from '../../utils/auth'

const ERROR_MESSAGES: Record<string, string | ((d: Record<string, unknown>) => string)> = {
  not_found: 'Акция не найдена',
  inactive: 'Акция неактивна',
  not_started: 'Акция ещё не началась',
  expired: 'Акция завершена',
  weekday: 'Акция не действует в этот день недели',
  time_range: (d) => `Акция действует с ${d.time_from} до ${d.time_to}`,
  min_order: (d) => `Минимальная сумма заказа — ${formatPrice(Number(d.min_order_amount))}`,
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const tenantId = String(body.tenantId ?? '').trim()
  const promotionId = String(body.promotionId ?? '').trim()
  const subtotal = Number(body.subtotal ?? 0)
  const scheduledAt = typeof body.scheduledAt === 'string' && body.scheduledAt ? body.scheduledAt : null

  if (!tenantId || !promotionId) throw createError({ statusCode: 400 })

  await requireMemberOfTenant(event, tenantId)

  const supabase = getServerSupabase()
  const { data, error } = await supabase.rpc('check_promotion_by_id', {
    p_tenant_id: tenantId,
    p_promotion_id: promotionId,
    p_subtotal: subtotal,
    ...(scheduledAt && { p_delivery_time: scheduledAt }),
  })

  if (error) {
    console.error('[promo/check-promotion]', error)
    throw createError({ statusCode: 500 })
  }

  const result = data as { valid: boolean; discount_amount: number; error?: string; title?: string; time_from?: string; time_to?: string; min_order_amount?: number }

  if (!result?.valid) {
    const errKey = result?.error ?? 'not_found'
    const msgOrFn = ERROR_MESSAGES[errKey] ?? 'Акция недоступна'
    const errorMessage = typeof msgOrFn === 'function' ? msgOrFn(result as Record<string, unknown>) : msgOrFn

    return { valid: false, discountAmount: 0, error: errorMessage }
  }

  return { valid: true, discountAmount: result.discount_amount, title: result.title }
})
