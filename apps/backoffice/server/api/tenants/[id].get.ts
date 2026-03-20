import { defineEventHandler, createError, getRouterParam } from 'h3'
import { getAdminClient } from '../../utils/adminClient'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  if (!id) throw createError({ statusCode: 400, message: 'Missing tenant id' })

  const supabase = getAdminClient()

  const { data: tenant, error } = await supabase
    .from('tenants')
    .select('id, name, slug, owner_id, subscription, balance, created_at')
    .eq('id', id)
    .single()

  if (error) throw createError({ statusCode: 500, message: error.message })
  if (!tenant) throw createError({ statusCode: 404, message: 'Tenant not found' })

  // Owner email
  const { data: emails } = await supabase.rpc('get_user_emails_admin', { user_ids: [tenant.owner_id] })
  const ownerEmail = emails?.[0]?.email ?? '—'

  // Transactions
  const { data: transactions } = await supabase
    .from('billing_transactions')
    .select('*')
    .eq('tenant_id', id)
    .order('created_at', { ascending: false })
    .limit(100)

  // Plans for reference
  const { data: plans } = await supabase.from('plans').select('*').order('sort_order')

  return {
    id: tenant.id,
    name: tenant.name,
    slug: tenant.slug,
    ownerEmail,
    subscription: tenant.subscription,
    balance: tenant.balance ?? 0,
    createdAt: tenant.created_at,
    transactions: transactions ?? [],
    plans: plans ?? [],
  }
})
