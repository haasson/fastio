import type { SupabaseClient } from '@supabase/supabase-js'
import type { Tenant } from '@fastio/shared'
import { defaultSiteLayout, defaultSiteContent, defaultTheme, defaultSeo, deepMerge } from '@fastio/shared'
import { query } from '~/utils/query'
import type { TenantRow } from './db-types'
import { filterDefined } from '~/utils/filterDefined'
import { optimizeImage } from '~/utils/imageOptimize'

const mapTenant = (raw: Record<string, unknown>): Tenant => {
  const row = raw as TenantRow

  return {
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    slug: row.slug,
    customDomain: row.custom_domain,
    businessType: row.business_type ?? null,
    theme: { ...defaultTheme(), ...row.theme },
    siteLayout: deepMerge(defaultSiteLayout(), row.site_layout ?? {}),
    siteContent: deepMerge(defaultSiteContent(), row.site_content ?? {}),
    contacts: row.contacts,
    workingHours: row.working_hours,
    notifications: row.notifications,
    subscription: row.subscription,
    deliveryEnabled: row.delivery_enabled,
    deliveryMinOrder: row.delivery_min_order,
    deliveryFee: row.delivery_fee,
    deliveryDescription: row.delivery_description,
    currency: row.currency,
    timezone: row.timezone,
    seo: { ...defaultSeo(), ...row.seo },
    createdAt: row.created_at,
  }
}

const tenantToDb = (data: Partial<Omit<Tenant, 'id' | 'ownerId' | 'createdAt'>>) => filterDefined({
  name: data.name,
  slug: data.slug,
  custom_domain: data.customDomain,
  business_type: data.businessType,
  theme: data.theme,
  site_layout: data.siteLayout,
  site_content: data.siteContent,
  contacts: data.contacts,
  working_hours: data.workingHours,
  notifications: data.notifications,
  subscription: data.subscription,
  delivery_enabled: data.deliveryEnabled,
  delivery_min_order: data.deliveryMinOrder,
  delivery_fee: data.deliveryFee,
  delivery_description: data.deliveryDescription,
  timezone: data.timezone,
  seo: data.seo,
}) as Partial<TenantRow>

export const tenantsApi = {
  async getById(sb: SupabaseClient, id: string): Promise<Tenant | null> {
    const data = await query(sb.from('tenants').select('*').eq('id', id).maybeSingle())

    return data ? mapTenant(data) : null
  },

  async update(sb: SupabaseClient, id: string, data: Partial<Omit<Tenant, 'id' | 'ownerId' | 'createdAt'>>) {
    await query(sb.from('tenants').update(tenantToDb(data)).eq('id', id))
  },

  async uploadAsset(sb: SupabaseClient, tenantId: string, file: File, filename: string): Promise<string> {
    const isSvg = file.type === 'image/svg+xml'
    const blob = isSvg ? file : await optimizeImage(file)
    const ext = isSvg ? 'svg' : 'webp'
    const contentType = isSvg ? 'image/svg+xml' : 'image/webp'
    const path = `${tenantId}/${filename}.${ext}`

    await query(sb.storage.from('tenant-assets').upload(path, blob, { contentType, upsert: true }))

    const { publicUrl } = sb.storage.from('tenant-assets').getPublicUrl(path).data

    return `${publicUrl}?t=${Date.now()}`
  },
}
