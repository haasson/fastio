import { defineEventHandler, getQuery, createError } from 'h3'
import { parseFiniteNumber } from '@fastio/shared'
import { getServerSupabase } from '../../utils/supabase'
import { requireMemberOfTenant } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const tenantId = String(query.tenantId ?? '').trim()
  const subtotal = parseFiniteNumber(query.subtotal ?? 0)
  const scheduledAt = typeof query.scheduledAt === 'string' && query.scheduledAt ? query.scheduledAt : null

  if (!tenantId) throw createError({ statusCode: 400, message: 'tenantId is required' })
  if (subtotal === null) {
    throw createError({ statusCode: 400, message: 'Некорректная сумма' })
  }

  await requireMemberOfTenant(event, tenantId)

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
