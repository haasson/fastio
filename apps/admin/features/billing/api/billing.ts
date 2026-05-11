import type { SupabaseClient } from '@supabase/supabase-js'
import type { BillingTransaction } from '@fastio/shared'
import { DEFAULT_TRIAL_DAYS } from '@fastio/shared'
import { query } from '~/shared/utils/query'

const mapTransaction = (row: Record<string, unknown>): BillingTransaction => ({
  id: row.id as string,
  tenantId: row.tenant_id as string,
  type: row.type as BillingTransaction['type'],
  amount: row.amount as number,
  description: row.description as string,
  planId: row.plan_id as string | null,
  createdBy: row.created_by as string | null,
  createdAt: row.created_at as string,
})

export const billingApi = {
  async getTransactions(sb: SupabaseClient, tenantId: string, limit = 50, offset = 0): Promise<BillingTransaction[]> {
    const data = await query(
      sb.from('billing_transactions')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1),
    )

    return (data ?? []).map(mapTransaction)
  },

  async getConfig(sb: SupabaseClient): Promise<{ trialDays: number }> {
    const data = await query(sb.from('billing_config').select('trial_days').single())
    const trialDays = data?.trial_days

    return { trialDays: typeof trialDays === 'number' ? trialDays : DEFAULT_TRIAL_DAYS }
  },

  async changePlan(sb: SupabaseClient, tenantId: string, newPlanKey: string): Promise<string> {
    return await query(sb.rpc('billing_change_plan', {
      p_tenant_id: tenantId,
      p_new_plan_key: newPlanKey,
    }))
  },
}
