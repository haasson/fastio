import { createClient } from '@supabase/supabase-js'
import type { Tenant, Category, Dish, Order } from '@fastio/shared'
import { mapDeliveryZoneRow } from '@fastio/shared'

export function getServerSupabase() {
  const config = useRuntimeConfig()
  return createClient(
    config.public.supabaseUrl,
    config.supabaseServiceRoleKey,
  )
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
    workingHours: row.working_hours as Tenant['workingHours'],
    notifications: row.notifications as Tenant['notifications'],
    subscription: row.subscription as Tenant['subscription'],
    deliveryEnabled: row.delivery_enabled as boolean,
    deliveryMinOrder: row.delivery_min_order as number,
    deliveryFee: row.delivery_fee as number,
    deliveryDescription: row.delivery_description as string,
    createdAt: row.created_at as string,
  }
}

export function mapCategory(row: Record<string, unknown>): Category {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    name: row.name as string,
    order: row.sort_order as number,
    active: row.active as boolean,
  }
}

export function mapDish(row: Record<string, unknown>): Dish {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    categoryId: row.category_id as string,
    name: row.name as string,
    description: row.description as string,
    price: row.price as number,
    photos: row.photos as string[],
    ingredients: row.ingredients as Dish['ingredients'],
    nutrition: row.nutrition as Dish['nutrition'],
    tags: row.tags as Dish['tags'],
    active: row.active as boolean,
    order: row.sort_order as number,
  }
}

export function mapOrder(row: Record<string, unknown>): Order {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    customer: row.customer as Order['customer'],
    items: row.items as Order['items'],
    deliveryType: row.delivery_type as Order['deliveryType'],
    address: row.address as string | null,
    comment: row.comment as string | null,
    promoCode: row.promo_code as string | null,
    discountAmount: row.discount_amount as number,
    subtotal: row.subtotal as number,
    deliveryFee: row.delivery_fee as number,
    total: row.total as number,
    status: row.status as Order['status'],
    paymentType: row.payment_type as Order['paymentType'],
    branchId: row.branch_id as string | null,
    deliveryZoneId: row.delivery_zone_id as string | null,
    createdAt: row.created_at as string,
  }
}

export { mapDeliveryZoneRow }
