import { findDeliveryZone } from '@fastio/shared'
import type { DeliveryZone, Tenant } from '@fastio/shared'
import { getServerSupabase, mapDeliveryZoneRow } from '../utils/supabase'

export default defineEventHandler(async (event) => {
  const tenantId = event.context.tenantId as string | undefined
  if (!tenantId) throw createError({ statusCode: 404 })

  const tenant = event.context.tenant as Tenant | undefined
  if (tenant && !tenant.modules?.delivery) {
    throw createError({ statusCode: 400, message: 'Доставка отключена' })
  }

  const body = await readBody(event)
  const lat = Number(body.lat)
  const lon = Number(body.lon)
  const subtotal = Number(body.subtotal ?? 0)

  if (Number.isNaN(lat) || Number.isNaN(lon)) {
    throw createError({ statusCode: 400, message: 'lat и lon обязательны' })
  }

  const supabase = getServerSupabase()

  const { data: activeBranches } = await supabase
    .from('branches')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .is('archived_at', null)

  const activeBranchIds = (activeBranches ?? []).map((b) => b.id)
  if (activeBranchIds.length === 0) return { zone: null }

  const { data: rows, error } = await supabase
    .from('delivery_zones')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .in('branch_id', activeBranchIds)
    .order('sort_order')

  if (error) {
    throw createError({ statusCode: 500, message: 'Ошибка загрузки зон доставки' })
  }

  // Если зон нет — возвращаем null, клиент использует tenant-level fee
  if (!rows || rows.length === 0) {
    return { zone: null }
  }

  const zones: DeliveryZone[] = rows.map(mapDeliveryZoneRow)

  const zone = findDeliveryZone([lon, lat], zones)

  if (!zone) {
    return { zone: null, outsideZones: true }
  }

  return {
    zone: {
      id: zone.id,
      branchId: zone.branchId,
      deliveryFee: zone.deliveryFee,
      minOrder: zone.minOrder,
      freeDeliveryFrom: zone.freeDeliveryFrom,
      effectiveDeliveryFee: zone.freeDeliveryFrom && zone.freeDeliveryFrom > 0 && subtotal >= zone.freeDeliveryFrom ? 0 : zone.deliveryFee,
    },
  }
})
