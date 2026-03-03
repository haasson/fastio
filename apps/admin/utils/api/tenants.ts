import type { SupabaseClient } from '@supabase/supabase-js'
import type { Tenant } from '@fastio/shared'
import { query } from '~/utils/query'

const mapTenant = (row: Record<string, unknown>): Tenant => ({
  id: row.id as string,
  ownerId: row.owner_id as string,
  name: row.name as string,
  slug: row.slug as string,
  customDomain: row.custom_domain as string | null,
  theme: row.theme as Tenant['theme'],
  contacts: row.contacts as Tenant['contacts'],
  workingHours: row.working_hours as Tenant['workingHours'],
  notifications: row.notifications as Tenant['notifications'],
  subscription: row.subscription as Tenant['subscription'],
  deliveryMinOrder: row.delivery_min_order as number,
  deliveryFee: row.delivery_fee as number,
  createdAt: row.created_at as string,
})

const tenantToDb = (data: Partial<Omit<Tenant, 'id' | 'ownerId' | 'createdAt'>>) => ({
  ...(data.name !== undefined && { name: data.name }),
  ...(data.slug !== undefined && { slug: data.slug }),
  ...(data.customDomain !== undefined && { custom_domain: data.customDomain }),
  ...(data.theme !== undefined && { theme: data.theme }),
  ...(data.contacts !== undefined && { contacts: data.contacts }),
  ...(data.workingHours !== undefined && { working_hours: data.workingHours }),
  ...(data.notifications !== undefined && { notifications: data.notifications }),
  ...(data.subscription !== undefined && { subscription: data.subscription }),
  ...(data.deliveryMinOrder !== undefined && { delivery_min_order: data.deliveryMinOrder }),
  ...(data.deliveryFee !== undefined && { delivery_fee: data.deliveryFee }),
})

export const tenantsApi = {
  async getById(sb: SupabaseClient, id: string): Promise<Tenant | null> {
    const data = await query(sb.from('tenants').select('*').eq('id', id).maybeSingle())

    return data ? mapTenant(data) : null
  },

  async update(sb: SupabaseClient, id: string, data: Partial<Omit<Tenant, 'id' | 'ownerId' | 'createdAt'>>) {
    await query(sb.from('tenants').update(tenantToDb(data)).eq('id', id))
  },
}
