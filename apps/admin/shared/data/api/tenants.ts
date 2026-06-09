import type { SupabaseClient } from '@supabase/supabase-js'
import type { Tenant, TenantColorPalettes, KitchenConfig, OrderNumberConfig, WorkingHoursSchedule, DeliveryMode, MenuStyle } from '@fastio/shared'
import { defaultSiteLayout, defaultSiteContent, defaultTheme, defaultSeo, deepMerge, parseSchedulingConfig, DEFAULT_PAYMENT_METHODS } from '@fastio/shared'
import { query } from '~/shared/utils/query'
import type { TenantRow } from '../db-types'
import { filterDefined } from '~/shared/utils/filterDefined'
import { optimizeImage } from '~/shared/utils/imageOptimize'

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
    ownerId: row.owner_id ?? '',
    name: row.name,
    slug: row.slug,
    customDomain: row.custom_domain,
    businessType: row.business_type ?? null,
    menuStyle: (row.menu_style as MenuStyle) ?? 'food',
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
    // Админка не использует (брони-флаг читается из table_settings напрямую);
    // поле обязательно по типу Tenant — ставим дефолт.
    bookingEnabled: false,
    currency: row.currency,
    timezone: row.timezone,
    seo: { ...defaultSeo(), ...row.seo },
    kitchenUrgencyMinutes: row.kitchen_urgency_minutes ?? 15,
    kitchenConfig: parseKitchenConfig(row.kitchen_config),
    orderNumberConfig: (row.order_number_config as OrderNumberConfig | null) ?? null,
    maxAddonsDefault: row.max_addons_default ?? null,
    onboardingCompleted: row.onboarding_completed,
    onboardingState: {
      currentStepId: row.onboarding_state?.current_step_id ?? null,
      completedAt: row.onboarding_state?.completed_at ?? null,
      dismissedAt: row.onboarding_state?.dismissed_at ?? null,
    },
    orderSchedulingConfig: parseSchedulingConfig(row.order_scheduling_config ?? {}),
    legalInfo: (row.legal_info as Tenant['legalInfo']) ?? null,
    paymentMethods: (row.payment_methods ?? [...DEFAULT_PAYMENT_METHODS]) as Tenant['paymentMethods'],
    ordersTileSize: (row.orders_tile_size as Tenant['ordersTileSize'] | null) ?? 'm',
    branchSelectionMode: row.branch_selection_mode,
    colorPalettes: {
      delivery_zones: (row.color_palettes as TenantColorPalettes)?.delivery_zones ?? [],
      branches: (row.color_palettes as TenantColorPalettes)?.branches ?? [],
      service_categories: (row.color_palettes as TenantColorPalettes)?.service_categories ?? [],
    },
    createdAt: row.created_at,
  }
}

// subscription/balance managed exclusively by billing functions (see trg_prevent_billing_self_update)
const tenantToDb = (data: Partial<Omit<Tenant, 'id' | 'ownerId' | 'createdAt'>>) => filterDefined({
  name: data.name,
  slug: data.slug,
  custom_domain: data.customDomain,
  business_type: data.businessType,
  menu_style: data.menuStyle,
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
  onboarding_state: data.onboardingState && {
    current_step_id: data.onboardingState.currentStepId,
    completed_at: data.onboardingState.completedAt,
    dismissed_at: data.onboardingState.dismissedAt,
  },
  order_scheduling_config: data.orderSchedulingConfig as Record<string, unknown> | undefined,
  legal_info: data.legalInfo,
  payment_methods: data.paymentMethods,
  orders_tile_size: data.ordersTileSize,
  branch_selection_mode: data.branchSelectionMode,
  color_palettes: data.colorPalettes,
}) as Partial<TenantRow>

export const tenantsApi = {
  async getById(sb: SupabaseClient, id: string): Promise<Tenant | null> {
    const data = await query(sb.from('tenants').select('*').eq('id', id).maybeSingle())

    return data ? mapTenant(data) : null
  },

  async update(sb: SupabaseClient, id: string, data: Partial<Omit<Tenant, 'id' | 'ownerId' | 'createdAt'>>) {
    await query(sb.from('tenants').update(tenantToDb(data)).eq('id', id))
  },

  // Read-modify-write: атомарность не нужна — палитру правит один владелец из
  // одной вкладки. query() на чтении обязателен, иначе тихий fail затрёт
  // остальные контексты при записи (palettes={} → перезапись всей колонки).
  async addColorPreset(
    sb: SupabaseClient,
    tenantId: string,
    context: keyof TenantColorPalettes,
    hex: string,
  ): Promise<void> {
    const row = await query(
      sb.from('tenants').select('color_palettes').eq('id', tenantId).single(),
    )

    const palettes = (row?.color_palettes ?? {}) as Partial<TenantColorPalettes>
    const current = palettes[context] ?? []

    if (current.includes(hex)) return

    await query(
      sb.from('tenants')
        .update({ color_palettes: { ...palettes, [context]: [...current, hex] } })
        .eq('id', tenantId),
    )
  },

  async updatePlan(sb: SupabaseClient, tenantId: string, planKey: string): Promise<'upgraded' | 'downgraded'> {
    const { data, error } = await sb.rpc('billing_change_plan', { p_tenant_id: tenantId, p_new_plan_key: planKey })

    if (error) throw new Error(error.message)

    return data as 'upgraded' | 'downgraded'
  },

  // Реактивация/выбор тарифа из баланса заблокированным тенантом (suspended/past_due).
  // Списывает цену выбранного плана и переводит подписку в active. См. billing_activate_plan
  // (318_billing_activate_plan.sql) — двойник кронового charge, но с caller-guard.
  async activatePlan(sb: SupabaseClient, tenantId: string, planKey: string): Promise<'activated' | 'already_active'> {
    const { data, error } = await sb.rpc('billing_activate_plan', { p_tenant_id: tenantId, p_plan_key: planKey })

    if (error) throw new Error(error.message)

    return data as 'activated' | 'already_active'
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
