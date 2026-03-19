import { defineEventHandler, createError } from 'h3'
import { getAdminClient } from '../../utils/adminClient'

/**
 * Ручной триггер биллинга — для дебага и принудительного запуска.
 * Основной механизм — pg_cron (068_billing_cron.sql).
 * Двойное списание невозможно: billing_charge_subscription использует FOR UPDATE.
 */
export default defineEventHandler(async () => {
  const supabase = getAdminClient()

  const { data: tenants, error: fetchError } = await supabase
    .from('tenants')
    .select('id, subscription')
    .or('subscription->>status.in.(active,past_due,trial)')

  if (fetchError) throw createError({ statusCode: 500, message: fetchError.message })

  const now = new Date()

  const dueTenants = (tenants ?? []).filter((tenant) => {
    const sub = tenant.subscription as { status: string; renewsAt?: string; trialEndsAt?: string }
    const renewsAt = sub.renewsAt ? new Date(sub.renewsAt) : null
    const trialEndsAt = sub.trialEndsAt ? new Date(sub.trialEndsAt) : null

    return sub.status === 'past_due'
      || (renewsAt && renewsAt <= now)
      || (sub.status === 'trial' && trialEndsAt && trialEndsAt <= now)
  })

  const BATCH_SIZE = 10
  const results: { tenantId: string; result: string }[] = []

  for (let i = 0; i < dueTenants.length; i += BATCH_SIZE) {
    const batch = dueTenants.slice(i, i + BATCH_SIZE)
    const batchResults = await Promise.all(
      batch.map(async (tenant) => {
        const { data, error } = await supabase.rpc('billing_charge_subscription', {
          p_tenant_id: tenant.id,
        })

        return {
          tenantId: tenant.id,
          result: error ? `error: ${error.message}` : data as string,
        }
      }),
    )

    results.push(...batchResults)
  }

  return { processed: results.length, results }
})
