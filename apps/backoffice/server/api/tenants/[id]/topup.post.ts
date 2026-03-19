import { defineEventHandler, createError, readBody, getRouterParam } from 'h3'
import { getAdminClient } from '../../../utils/adminClient'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  if (!id) throw createError({ statusCode: 400, message: 'Missing tenant id' })

  const body = await readBody(event)
  const amount = Number(body.amount)

  if (!amount || amount <= 0) throw createError({ statusCode: 400, message: 'Invalid amount' })

  const supabase = getAdminClient()

  const { data, error } = await supabase.rpc('billing_topup', {
    p_tenant_id: id,
    p_amount: amount,
    p_description: body.description || 'Пополнение через бэкофис',
    p_admin_user_id: null,
  })

  if (error) throw createError({ statusCode: 500, message: error.message })

  return data
})
