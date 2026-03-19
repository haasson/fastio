import { defineEventHandler, createError, readBody, getRouterParam } from 'h3'
import { getAdminClient } from '../../../utils/adminClient'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  if (!id) throw createError({ statusCode: 400, message: 'Missing tenant id' })

  const body = await readBody(event)

  if (!body.plan_key) throw createError({ statusCode: 400, message: 'Missing plan_key' })

  const supabase = getAdminClient()

  const { data, error } = await supabase.rpc('billing_change_plan', {
    p_tenant_id: id,
    p_new_plan_key: body.plan_key,
    p_user_id: null,
  })

  if (error) throw createError({ statusCode: 500, message: error.message })

  return { result: data }
})
