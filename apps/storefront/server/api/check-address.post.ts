import { findDeliveryZone } from '@fastio/shared'
import type { DeliveryZone, Tenant } from '@fastio/shared'
import { mapDeliveryZoneRow } from '../utils/supabase'
import { getTenantDb } from '../utils/tenantDb'

export default defineEventHandler(async (event) => {
  const db = getTenantDb(event)
  const tenant = event.context.tenant as Tenant

  if (!tenant.modules?.delivery) {
    throw createError({ statusCode: 400, message: 'Доставка отключена' })
  }

  if (tenant.deliveryMode === 'fixed') {
    return {
      zone: null,
      fixed: true,
      deliveryFee: tenant.deliveryFee,
      freeDeliveryFrom: tenant.freeDeliveryFrom,
      minOrder: tenant.deliveryMinOrder,
    }
  }

  const body = await readBody(event)
  const lat = Number(body.lat)
  const lon = Number(body.lon)
  const subtotal = Number(body.subtotal ?? 0)

  if (Number.isNaN(lat) || Number.isNaN(lon)) {
    throw createError({ statusCode: 400, message: 'lat и lon обязательны' })
  }

  const { data: activeBranches } = await db
    .from('branches')
    .select('id')
    .eq('is_active', true)
    .is('archived_at', null)
  const activeBranchIds = (activeBranches ?? []).map((b) => b.id as string)
  if (activeBranchIds.length === 0) return { zone: null }

  const { data: rows, error } = await db
    .from('delivery_zones')
    .select('*')
    .eq('is_active', true)
    .in('branch_id', activeBranchIds)
    .order('sort_order')

  if (error) {
    throw createError({ statusCode: 500, message: 'Ошибка загрузки зон доставки' })
  }

  if (!rows || rows.length === 0) {
    return { zone: null, outsideZones: true }
  }

  const zones: DeliveryZone[] = rows.map(mapDeliveryZoneRow)

  const zone = findDeliveryZone([lon, lat], zones)

  if (!zone) {
    return { zone: null, outsideZones: true }
  }

  // Fetch branch schedule for the matched zone's branch
  let branchSchedule = null
  if (zone.branchId) {
    const { data: branch } = await db.raw
      .from('branches')
      .select('working_hours_schedule')
      .eq('id', zone.branchId)
      .single()

    branchSchedule = branch?.working_hours_schedule ?? tenant.workingHoursSchedule ?? null
  }

  return {
    zone: {
      id: zone.id,
      branchId: zone.branchId,
      deliveryFee: zone.deliveryFee,
      minOrder: zone.minOrder,
      freeDeliveryFrom: zone.freeDeliveryFrom,
      effectiveDeliveryFee: zone.freeDeliveryFrom && zone.freeDeliveryFrom > 0 && subtotal >= zone.freeDeliveryFrom ? 0 : zone.deliveryFee,
      branchSchedule,
    },
  }
})
