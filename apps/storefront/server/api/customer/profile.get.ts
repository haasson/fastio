import { mapCustomer } from '../../utils/supabase'
import { getAuthenticatedContext } from '../../utils/customerAuth'

export default defineEventHandler(async (event) => {
  const { customerId, supabase } = await getAuthenticatedContext(event)
  const tenantId = event.context.tenantId as string

  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('id', customerId)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (error) throw createError({ statusCode: 500, message: error.message })
  if (!data) throw createError({ statusCode: 404, message: 'Профиль не найден' })

  return { customer: mapCustomer(data) }
})
