import type { SupabaseClient } from '@supabase/supabase-js'
import type { Tenant } from '@fastio/shared'
import { query } from '~/utils/query'
import type { TenantRow } from './db-types'
import { filterDefined } from '~/utils/filterDefined'

const mapTenant = (raw: Record<string, unknown>): Tenant => {
  const row = raw as TenantRow

  return {
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    slug: row.slug,
    customDomain: row.custom_domain,
    theme: row.theme,
    contacts: row.contacts,
    workingHours: row.working_hours,
    notifications: row.notifications,
    subscription: row.subscription,
    deliveryMinOrder: row.delivery_min_order,
    deliveryFee: row.delivery_fee,
    deliveryDescription: row.delivery_description,
    createdAt: row.created_at,
  }
}

const tenantToDb = (data: Partial<Omit<Tenant, 'id' | 'ownerId' | 'createdAt'>>) => filterDefined({
  name: data.name,
  slug: data.slug,
  custom_domain: data.customDomain,
  theme: data.theme,
  contacts: data.contacts,
  working_hours: data.workingHours,
  notifications: data.notifications,
  subscription: data.subscription,
  delivery_min_order: data.deliveryMinOrder,
  delivery_fee: data.deliveryFee,
  delivery_description: data.deliveryDescription,
}) as Partial<TenantRow>

export const tenantsApi = {
  async getById(sb: SupabaseClient, id: string): Promise<Tenant | null> {
    const data = await query(sb.from('tenants').select('*').eq('id', id).maybeSingle())

    return data ? mapTenant(data) : null
  },

  async update(sb: SupabaseClient, id: string, data: Partial<Omit<Tenant, 'id' | 'ownerId' | 'createdAt'>>) {
    await query(sb.from('tenants').update(tenantToDb(data)).eq('id', id))
  },
}
