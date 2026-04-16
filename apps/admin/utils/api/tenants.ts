import type { SupabaseClient } from '@supabase/supabase-js'
import type { Tenant, KitchenConfig, OrderNumberConfig, WorkingHoursSchedule, DeliveryMode } from '@fastio/shared'
import { defaultSiteLayout, defaultSiteContent, defaultTheme, defaultSeo, deepMerge, parseSchedulingConfig } from '@fastio/shared'
import { query } from '~/utils/query'
import type { TenantRow } from './db-types'
import { filterDefined } from '~/utils/filterDefined'
import { optimizeImage } from '~/utils/imageOptimize'

const DEFAULT_KITCHEN_CONFIG: KitchenConfig = {
  sourceStatusId: null,
  cookingStatusId: null,
  completedStatusMap: { delivery: null, pickup: null, dine_in: null },
}

const parseKitchenConfig = (raw: KitchenConfig): KitchenConfig => ({
  sourceStatusId: raw?.sourceStatusId ?? DEFAULT_KITCHEN_CONFIG.sourceStatusId,
  cookingStatusId: raw?.cookingStatusId ?? null,
  completedStatusMap: {
    delivery: raw?.completedStatusMap?.delivery ?? null,
    pickup: raw?.completedStatusMap?.pickup ?? null,
    dine_in: raw?.completedStatusMap?.dine_in ?? null,
  },
})

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
    workingHoursSchedule: row.working_hours_schedule ?? null,
    notifications: row.notifications,
    balance: row.balance ?? 0,
    subscription: row.subscription,
    modules: row.modules,
    deliveryMinOrder: row.delivery_min_order,
    deliveryFee: row.delivery_fee,
    freeDeliveryFrom: row.free_delivery_from ?? 0,
    deliveryDescription: row.delivery_description,
    deliveryMode: (row.delivery_mode ?? 'zones') as DeliveryMode,
    deliveryAvailable: false,
    orderingEnabled: false,
    currency: row.currency,
    timezone: row.timezone,
    seo: { ...defaultSeo(), ...row.seo },
    kitchenUrgencyMinutes: row.kitchen_urgency_minutes ?? 15,
    kitchenConfig: parseKitchenConfig(row.kitchen_config),
    orderNumberConfig: (row.order_number_config as OrderNumberConfig | null) ?? null,
    maxAddonsDefault: row.max_addons_default ?? null,
    onboardingCompleted: row.onboarding_completed,
    orderSchedulingConfig: parseSchedulingConfig(row.order_scheduling_config ?? {}),
    legalInfo: (row.legal_info as Tenant['legalInfo']) ?? null,
    createdAt: row.created_at,
  }
}

// subscription/balance managed exclusively by billing functions (see trg_prevent_billing_self_update)
const tenantToDb = (data: Partial<Omit<Tenant, 'id' | 'ownerId' | 'createdAt'>>) => filterDefined({
  name: data.name,
  slug: data.slug,
  custom_domain: data.customDomain,
  business_type: data.businessType,
  theme: data.theme,
  site_layout: data.siteLayout,
  site_content: data.siteContent,
  contacts: data.contacts,
  working_hours_schedule: data.workingHoursSchedule as WorkingHoursSchedule | undefined,
  notifications: data.notifications,
  modules: data.modules,
  delivery_min_order: data.deliveryMinOrder,
  delivery_fee: data.deliveryFee,
  free_delivery_from: data.freeDeliveryFrom,
  delivery_description: data.deliveryDescription,
  delivery_mode: data.deliveryMode,
  timezone: data.timezone,
  seo: data.seo,
  kitchen_config: data.kitchenConfig,
  kitchen_urgency_minutes: data.kitchenUrgencyMinutes,
  order_number_config: data.orderNumberConfig,
  max_addons_default: data.maxAddonsDefault,
  onboarding_completed: data.onboardingCompleted,
  order_scheduling_config: data.orderSchedulingConfig as Record<string, unknown> | undefined,
  legal_info: data.legalInfo,
}) as Partial<TenantRow>

export const tenantsApi = {
  async getById(sb: SupabaseClient, id: string): Promise<Tenant | null> {
    const data = await query(sb.from('tenants').select('*').eq('id', id).maybeSingle())

    return data ? mapTenant(data) : null
  },

  async update(sb: SupabaseClient, id: string, data: Partial<Omit<Tenant, 'id' | 'ownerId' | 'createdAt'>>) {
    await query(sb.from('tenants').update(tenantToDb(data)).eq('id', id))
  },

  async uploadDocument(sb: SupabaseClient, tenantId: string, file: File, slug: 'privacy' | 'offer'): Promise<string> {
    const path = `${tenantId}/${slug}.pdf`

    await query(sb.storage.from('documents').upload(path, file, { contentType: 'application/pdf', upsert: true }))

    const { publicUrl } = sb.storage.from('documents').getPublicUrl(path).data

    return `${publicUrl}?t=${Date.now()}`
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
