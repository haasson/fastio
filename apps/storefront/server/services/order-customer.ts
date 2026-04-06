import type { SupabaseClient } from '@supabase/supabase-js'
import { getAuthSupabase } from '../utils/supabase'

export type ResolvedCustomer = {
  customerId: string | null
  authUserId: string | null
}

export async function resolveCustomer(
  supabase: SupabaseClient,
  tenantId: string,
  authHeader: string | undefined,
): Promise<ResolvedCustomer> {
  if (!authHeader) {
    return { customerId: null, authUserId: null }
  }

  try {
    const authClient = getAuthSupabase(authHeader)
    const { data: { user } } = await authClient.auth.getUser()

    if (!user) {
      return { customerId: null, authUserId: null }
    }

    const { data: customerData } = await supabase
      .from('customers')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('auth_user_id', user.id)
      .maybeSingle()

    return {
      customerId: customerData?.id as string ?? null,
      authUserId: user.id,
    }
  }
  catch {
    return { customerId: null, authUserId: null }
  }
}
