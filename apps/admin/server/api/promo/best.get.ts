import { defineEventHandler, getQuery, createError } from 'h3'
import { getServerSupabase } from '../../utils/supabase'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const tenantId = String(query.tenantId ?? '').trim()
  const subtotal = Number(query.subtotal ?? 0)
  const scheduledAt = typeof query.scheduledAt === 'string' && query.scheduledAt ? query.scheduledAt : null

  if (!tenantId) throw createError({ statusCode: 400, message: 'tenantId is required' })
  if (!Number.isFinite(subtotal) || subtotal < 0) {
    throw createError({ statusCode: 400, message: 'Некорректная сумма' })
  }

  const supabase = getServerSupabase()
  const { data, error } = await supabase.rpc('get_best_promotion', {
    p_tenant_id: tenantId,
    p_subtotal: subtotal,
    ...(scheduledAt && { p_delivery_time: scheduledAt }),
  })

  if (error) {
    console.error('[promo/best]', error)
    throw createError({ statusCode: 500 })
  }

  return data as { promotion_id: string; title: string; discount_amount: number } | null
})
