import { createClient } from '@supabase/supabase-js'
import { defineEventHandler, createError } from 'h3'
import { useRuntimeConfig } from '#imports'

type TenantRow = {
  id: string
  name: string
  slug: string
  ownerEmail: string
  branchCount: number
  createdAt: string
}

export default defineEventHandler(async (): Promise<TenantRow[]> => {
  const config = useRuntimeConfig()

  const supabase = createClient(
    config.public.supabaseUrl,
    config.supabaseServiceKey,
    { auth: { persistSession: false } },
  )

  const [tenantsResult, branchesResult] = await Promise.all([
    supabase.from('tenants').select('id, name, slug, created_at, owner_id'),
    supabase.from('branches').select('tenant_id'),
  ])

  if (tenantsResult.error) throw createError({ statusCode: 500, message: tenantsResult.error.message })
  if (branchesResult.error) throw createError({ statusCode: 500, message: branchesResult.error.message })

  const ownerIds = tenantsResult.data.map((t) => t.owner_id)

  const { data: userEmails, error: usersError } = await supabase.rpc('get_user_emails', { user_ids: ownerIds })

  if (usersError) throw createError({ statusCode: 500, message: usersError.message })

  const branchCountByTenant = new Map<string, number>()

  for (const branch of branchesResult.data) {
    branchCountByTenant.set(branch.tenant_id, (branchCountByTenant.get(branch.tenant_id) ?? 0) + 1)
  }

  const emailByUserId = new Map<string, string>()

  for (const row of (userEmails ?? [])) {
    emailByUserId.set(row.user_id, row.email ?? '')
  }

  return tenantsResult.data.map((tenant) => ({
    id: tenant.id,
    name: tenant.name,
    slug: tenant.slug,
    ownerEmail: emailByUserId.get(tenant.owner_id) ?? '—',
    branchCount: branchCountByTenant.get(tenant.id) ?? 0,
    createdAt: tenant.created_at,
  }))
})
