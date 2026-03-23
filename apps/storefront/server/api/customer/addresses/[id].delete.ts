import { getAuthenticatedContext } from '../../../utils/customerAuth'

export default defineEventHandler(async (event) => {
  const { customerId, supabase } = await getAuthenticatedContext(event)
  const addressId = getRouterParam(event, 'id')
  if (!addressId) throw createError({ statusCode: 400 })

  const { error } = await supabase
    .from('customer_addresses')
    .delete()
    .eq('id', addressId)
    .eq('customer_id', customerId)

  if (error) throw createError({ statusCode: 500, message: error.message })

  return { ok: true }
})
