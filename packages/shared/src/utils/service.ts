import type { Service, BookingMode } from '../types/service'

export const mapService = (raw: Record<string, unknown>): Service => ({
  id: raw.id as string,
  tenantId: raw.tenant_id as string,
  categoryId: raw.category_id as string | null,
  name: raw.name as string,
  description: (raw.description as string) ?? '',
  price: raw.price as number,
  duration: raw.duration as number,
  photos: (raw.photos as string[]) ?? [],
  tags: (raw.tags as string[]) ?? [],
  isBookable: raw.is_bookable as boolean,
  bookingMode: (raw.booking_mode as BookingMode) ?? 'fixed',
  maxDuration: (raw.max_duration as number | null) ?? null,
  allowResourceChoice: (raw.allow_resource_choice as boolean) ?? true,
  active: raw.active as boolean,
  sortOrder: raw.sort_order as number,
  longDescription: (raw.long_description as string | null) ?? null,
  createdAt: raw.created_at as string,
  updatedAt: raw.updated_at as string,
})
