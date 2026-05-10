import type { SupabaseClient } from '@supabase/supabase-js'
import type { DeliveryZone, DeliveryZoneFormData, DeliveryZoneRow } from '@fastio/shared'
import { mapDeliveryZoneRow } from '@fastio/shared'
import { query } from '~/shared/utils/query'

export const mapDeliveryZone = (raw: Record<string, unknown>): DeliveryZone => mapDeliveryZoneRow(raw as DeliveryZoneRow)

const zoneToDb = (data: Partial<DeliveryZoneFormData>) => ({
  ...(data.branchId !== undefined && { branch_id: data.branchId }),
  ...(data.name !== undefined && { name: data.name }),
  ...(data.color !== undefined && { color: data.color }),
  ...(data.coordinates !== undefined && { coordinates: data.coordinates }),
  ...(data.deliveryFee !== undefined && { delivery_fee: data.deliveryFee }),
  ...(data.minOrder !== undefined && { min_order: data.minOrder }),
  ...(data.freeDeliveryFrom !== undefined && { free_delivery_from: data.freeDeliveryFrom }),
  ...(data.isActive !== undefined && { is_active: data.isActive }),
})

export const deliveryZonesApi = {
  async list(sb: SupabaseClient, branchId: string): Promise<DeliveryZone[]> {
    const data = await query(
      sb.from('delivery_zones').select('*').eq('branch_id', branchId).order('sort_order'),
    )

    return (data ?? []).map(mapDeliveryZone)
  },

  async listAll(sb: SupabaseClient, tenantId: string): Promise<DeliveryZone[]> {
    const data = await query(
      sb.from('delivery_zones').select('*').eq('tenant_id', tenantId).order('sort_order'),
    )

    return (data ?? []).map(mapDeliveryZone)
  },

  async add(sb: SupabaseClient, tenantId: string, data: DeliveryZoneFormData): Promise<DeliveryZone | null> {
    const result = await query(
      sb.from('delivery_zones').insert({
        tenant_id: tenantId,
        ...zoneToDb(data),
      }).select().single(),
    )

    return result ? mapDeliveryZone(result) : null
  },

  async update(sb: SupabaseClient, id: string, data: Partial<DeliveryZoneFormData>): Promise<DeliveryZone | null> {
    const result = await query(
      sb.from('delivery_zones').update(zoneToDb(data)).eq('id', id).select().single(),
    )

    return result ? mapDeliveryZone(result) : null
  },

  async remove(sb: SupabaseClient, id: string): Promise<void> {
    await query(sb.from('delivery_zones').delete().eq('id', id))
  },
}
