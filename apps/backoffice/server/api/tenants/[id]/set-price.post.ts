import { defineEventHandler, createError, readBody, getRouterParam } from 'h3'
import { getAdminClient } from '../../../utils/adminClient'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  if (!id) throw createError({ statusCode: 400, message: 'Missing tenant id' })

  const body = await readBody(event)
  const price = body.price === null || body.price === '' ? null : Number(body.price)

  if (price !== null && (isNaN(price) || price < 0)) {
    throw createError({ statusCode: 400, message: 'Invalid price' })
  }

  const supabase = getAdminClient()

  const { error } = await supabase.rpc('billing_set_price_override', {
    p_tenant_id: id,
    p_price: price,
  })

  if (error) throw createError({ statusCode: 500, message: error.message })

  return { ok: true }
})
