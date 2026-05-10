import type { Category, CategoryType, CategoryKind } from '../types/menu'

/**
 * Маппер строки `categories` в доменный `Category`.
 * Был задублирован в admin (`apps/admin/utils/api/categories.ts`) и
 * storefront (`apps/storefront/server/utils/supabase.ts`); единая правда здесь —
 * чтобы NULL'ы из БД одинаково схлопывались в дефолты на обоих фронтах.
 */
export const mapCategory = (raw: Record<string, unknown>): Category => ({
  id: raw.id as string,
  tenantId: raw.tenant_id as string,
  name: raw.name as string,
  slug: (raw.slug as string | null) ?? null,
  type: (raw.type as CategoryType | null) ?? 'regular',
  kind: (raw.kind as CategoryKind | null) ?? 'food',
  tagId: (raw.tag_id as string | null) ?? null,
  order: raw.sort_order as number,
  active: raw.active as boolean,
  photoUrl: (raw.photo_url as string | null) ?? null,
  useFirstDishPhoto: (raw.use_first_dish_photo as boolean | null) ?? false,
  color: (raw.color as string | null) ?? null,
})
