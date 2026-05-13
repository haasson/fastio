import { defineEventHandler, getQuery, createError } from 'h3'
import { getServerSupabase } from '../../utils/supabase'
import { requireMemberOfTenant } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const tenantId = String(query.tenantId ?? '').trim()
  const promotionId = String(query.promotionId ?? '').trim()
  const subtotal = Number(query.subtotal ?? 0)
  const scheduledAt = typeof query.scheduledAt === 'string' && query.scheduledAt ? query.scheduledAt : null

  if (!tenantId || !promotionId) throw createError({ statusCode: 400, message: 'tenantId и promotionId обязательны' })
  if (!Number.isFinite(subtotal) || subtotal < 0) {
    throw createError({ statusCode: 400, message: 'Некорректная сумма' })
  }

  await requireMemberOfTenant(event, tenantId)

  const supabase = getServerSupabase()
  const { data, error } = await supabase.rpc('check_promotion_by_id', {
    p_tenant_id: tenantId,
    p_promotion_id: promotionId,
    p_subtotal: subtotal,
    ...(scheduledAt && { p_delivery_time: scheduledAt }),
  })

  if (error) {
    console.error('[promo/recalculate]', error)

    return { discountAmount: 0 }
  }

  const result = data as { valid: boolean; discount_amount: number; title?: string } | null

  if (!result?.valid) return { discountAmount: 0 }

  return { discountAmount: result.discount_amount, title: result.title }
})
