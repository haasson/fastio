import { createClient } from '@supabase/supabase-js'
import type { Tenant, Category, CategoryType, Dish, Combo, Order, Customer, CustomerAddress, OrderNumberConfig, WorkingHoursSchedule, DeliveryMode } from '@fastio/shared'
import { mapDeliveryZoneRow, defaultSeo, resolveModules } from '@fastio/shared'

export function getServerSupabase() {
  const config = useRuntimeConfig()
  return createClient(
    config.public.supabaseUrl,
    config.supabaseServiceRoleKey,
  )
}

export function getAuthSupabase(authHeader: string) {
  const config = useRuntimeConfig()
  return createClient(config.public.supabaseUrl, config.public.supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  })
}

export function mapTenant(row: Record<string, unknown>): Tenant {
  return {
    id: row.id as string,
    ownerId: row.owner_id as string,
    name: row.name as string,
    slug: row.slug as string,
    customDomain: row.custom_domain as string | null,
    theme: row.theme as Tenant['theme'],
    siteLayout: row.site_layout as Tenant['siteLayout'],
    siteContent: row.site_content as Tenant['siteContent'],
    contacts: row.contacts as Tenant['contacts'],
    workingHoursSchedule: (row.working_hours_schedule as WorkingHoursSchedule | null) ?? null,
    notifications: row.notifications as Tenant['notifications'],
    balance: (row.balance as number) ?? 0,
    subscription: row.subscription as Tenant['subscription'],
    modules: resolveModules(row.modules as Tenant['modules'], (row.business_type ?? null) as Tenant['businessType']),
    deliveryMinOrder: row.delivery_min_order as number,
    deliveryFee: row.delivery_fee as number,
    freeDeliveryFrom: (row.free_delivery_from as number) ?? 0,
    businessType: (row.business_type ?? null) as Tenant['businessType'],
    deliveryDescription: row.delivery_description as string,
    deliveryMode: ((row.delivery_mode as string) ?? 'zones') as DeliveryMode,
    deliveryAvailable: false,
    orderingEnabled: false,
    currency: row.currency as string,
    timezone: row.timezone as string,
    seo: { ...defaultSeo(), ...(row.seo as object ?? {}) },
    kitchenUrgencyMinutes: (row.kitchen_urgency_minutes as number) ?? 15,
    kitchenConfig: row.kitchen_config as Tenant['kitchenConfig'],
    orderNumberConfig: (row.order_number_config as OrderNumberConfig | null) ?? null,
    maxAddonsDefault: (row.max_addons_default as number | null) ?? null,
    onboardingCompleted: (row.onboarding_completed as boolean) ?? false,
    createdAt: row.created_at as string,
  }
}

export function mapCategory(row: Record<string, unknown>): Category {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    name: row.name as string,
    type: (row.type as CategoryType) ?? 'regular',
    tagId: (row.tag_id as string) ?? null,
    order: row.sort_order as number,
    active: row.active as boolean,
    photoUrl: row.photo_url as string | null,
    useFirstDishPhoto: row.use_first_dish_photo as boolean,
  }
}

export function mapCombo(row: Record<string, unknown>): Combo {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    categoryId: row.category_id as string,
    name: row.name as string,
    description: row.description as string,
    price: row.price as number,
    photos: row.photos as string[],
    tags: [],
    active: row.active as boolean,
    order: row.sort_order as number,
  }
}

export function mapDish(row: Record<string, unknown>): Dish {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    categoryId: row.category_id as string,
    name: row.name as string,
    description: row.description as string,
    longDescription: (row.long_description as string | null) ?? null,
    price: row.price as number,
    photos: row.photos as string[],
    ingredients: row.ingredients as Dish['ingredients'],
    nutrition: row.nutrition as Dish['nutrition'],
    weightUnit: (row.weight_unit as 'г' | 'мл') ?? 'г',
    tags: [],
    active: row.active as boolean,
    order: row.sort_order as number,
    requiresKitchen: row.requires_kitchen as boolean,
    maxAddons: (row.max_addons as number | null) ?? null,
  }
}

export function mapOrder(row: Record<string, unknown>): Order {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    customerName: row.customer_name as string,
    customerPhone: row.customer_phone as string,
    customerEmail: row.customer_email as string | null,
    items: ((row.order_items ?? []) as Record<string, unknown>[]).map((item) => ({
      id: item.id as string,
      orderId: item.order_id as string,
      dishId: item.dish_id as string | null,
      dishName: item.dish_name as string,
      categoryName: item.category_name as string | null,
      price: item.price as number,
      quantity: item.quantity as number,
      removedIngredients: (item.removed_ingredients ?? []) as string[],
      modifiers: (item.modifiers ?? []) as Order['items'][0]['modifiers'],
      addons: (item.addons ?? []) as Order['items'][0]['addons'],
      sortOrder: item.sort_order as number,
      completedAt: (item.completed_at as string) ?? null,
      comboId: (item.combo_id as string) ?? null,
      comboItems: (item.combo_items as Order['items'][0]['comboItems']) ?? null,
      addedBy: (item.added_by as string) ?? null,
      confirmedBy: (item.confirmed_by as string) ?? null,
      status: (item.status as 'pending' | 'confirmed') ?? 'confirmed',
    })),
    deliveryType: row.delivery_type as Order['deliveryType'],
    address: row.address as string | null,
    comment: row.comment as string | null,
    promoCode: row.promo_code as string | null,
    discountAmount: row.discount_amount as number,
    subtotal: row.subtotal as number,
    deliveryFee: row.delivery_fee as number,
    total: row.total as number,
    status: row.status as Order['status'],
    statusGroup: (row._statusInfo as { group_type: string } | null)?.group_type as Order['statusGroup'] ?? null,
    statusName: (row._statusInfo as { name: string } | null)?.name ?? null,
    paymentType: row.payment_type as Order['paymentType'],
    branchId: row.branch_id as string | null,
    branchAddress: (row._branchInfo as { address: string } | null)?.address ?? null,
    deliveryZoneId: row.delivery_zone_id as string | null,
    tableId: row.table_id as string | null,
    tableName: row.table_name as string | null,
    orderNumber: (row.order_number as string | null) ?? null,
    acceptedBy: (row.accepted_by as string | null) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }
}

export function mapCustomer(row: Record<string, unknown>): Customer {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    authUserId: row.auth_user_id as string,
    name: row.name as string | null,
    phone: row.phone as string | null,
    email: row.email as string | null,
    avatarUrl: row.avatar_url as string | null,
    createdAt: row.created_at as string,
  }
}

export function mapCustomerAddress(row: Record<string, unknown>): CustomerAddress {
  const coords = row.coordinates as string | null
  // Supabase returns point as "(lng,lat)" string
  let lat = 0
  let lng = 0
  if (coords) {
    const match = coords.match(/\(([^,]+),([^)]+)\)/)
    if (match) {
      const parsedLng = parseFloat(match[1])
      const parsedLat = parseFloat(match[2])
      if (!Number.isNaN(parsedLng) && !Number.isNaN(parsedLat)) {
        lng = parsedLng
        lat = parsedLat
      }
    }
  }

  return {
    id: row.id as string,
    customerId: row.customer_id as string,
    label: row.label as string,
    address: row.address as string,
    coordinates: { lat, lng },
    entrance: row.entrance as string | null,
    floor: row.floor as string | null,
    apartment: row.apartment as string | null,
    intercom: row.intercom as string | null,
    comment: row.comment as string | null,
    createdAt: row.created_at as string,
  }
}

export async function getActiveBranchIds(
  supabase: ReturnType<typeof getServerSupabase>,
  tenantId: string,
): Promise<string[]> {
  const { data } = await supabase
    .from('branches')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .is('archived_at', null)
  return (data ?? []).map((b) => b.id as string)
}

export { mapDeliveryZoneRow }
