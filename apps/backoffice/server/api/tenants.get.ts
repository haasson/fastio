import { defineEventHandler, createError } from 'h3'
import { getAdminClient } from '../utils/adminClient'

type TenantRow = {
  id: string
  name: string
  slug: string
  ownerEmail: string
  plan: string
  balance: number
  branchCount: number
  createdAt: string
  isActivated: boolean
  selfRegistered: boolean
}

export default defineEventHandler(async (): Promise<TenantRow[]> => {
  const supabase = getAdminClient()

  const [tenantsResult, branchesResult, usersResult] = await Promise.all([
    supabase.from('tenants').select('id, name, slug, created_at, owner_id, subscription, balance, self_registered'),
    supabase.from('branches').select('tenant_id'),
    supabase.auth.admin.listUsers({ perPage: 1000 }),
  ])

  if (tenantsResult.error) throw createError({ statusCode: 500, message: tenantsResult.error.message })
  if (branchesResult.error) throw createError({ statusCode: 500, message: branchesResult.error.message })
  if (usersResult.error) throw createError({ statusCode: 500, message: usersResult.error.message })

  const branchCountByTenant = new Map<string, number>()

  for (const branch of branchesResult.data) {
    branchCountByTenant.set(branch.tenant_id, (branchCountByTenant.get(branch.tenant_id) ?? 0) + 1)
  }

  const userById = new Map(usersResult.data.users.map((u) => [u.id, u]))

  return tenantsResult.data.map((tenant) => {
    const user = userById.get(tenant.owner_id)

    return {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      ownerEmail: user?.email ?? '—',
      plan: (tenant.subscription as { plan?: string })?.plan ?? 'service',
      balance: tenant.balance ?? 0,
      branchCount: branchCountByTenant.get(tenant.id) ?? 0,
      createdAt: tenant.created_at,
      isActivated: !!user?.email_confirmed_at,
      selfRegistered: !!(tenant as Record<string, unknown>).self_registered,
    }
  })
})
