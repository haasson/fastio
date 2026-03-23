import { mapCustomerAddress } from '../../../utils/supabase'
import { getAuthenticatedContext } from '../../../utils/customerAuth'

export default defineEventHandler(async (event) => {
  const { customerId, supabase } = await getAuthenticatedContext(event)

  const { data, error } = await supabase
    .from('customer_addresses')
    .select('*')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })

  if (error) throw createError({ statusCode: 500, message: error.message })

  return (data ?? []).map(mapCustomerAddress)
})
