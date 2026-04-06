import type { SupabaseClient } from '@supabase/supabase-js'
import type { DeliveryZone, DeliveryZoneRow } from '@fastio/shared'
import { findDeliveryZone, mapDeliveryZoneRow } from '@fastio/shared'
import type { DeliveryType, TenantOrderConfig } from './order-validation'
import { calcDeliveryFee } from './order-calc'

export type TableRecord = {
  id: string
  name: string
}

export type DeliveryResult = {
  matchedZone: DeliveryZone | null
  branchId: string | null
  deliveryFee: number
  tableRecord: TableRecord | null
}

export async function validateTable(
  supabase: SupabaseClient,
  tenantId: string,
  tableId: string | undefined,
): Promise<TableRecord> {
  if (!tableId) {
    throw createError({ statusCode: 400, message: 'Не указан стол' })
  }

  const { data: tableData } = await supabase
    .from('tables')
    .select('id, name, is_open')
    .eq('id', tableId)
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .single()

  if (!tableData) throw createError({ statusCode: 404, message: 'Стол не найден' })
  if (!tableData.is_open) throw createError({ statusCode: 400, message: 'Стол сейчас не обслуживается' })

  return { id: tableData.id as string, name: tableData.name as string }
}

export async function resolveDelivery(
  supabase: SupabaseClient,
  tenantId: string,
  deliveryType: DeliveryType,
  body: Record<string, unknown>,
  tenantConfig: TenantOrderConfig,
  subtotal: number,
): Promise<DeliveryResult> {
  let tableRecord: TableRecord | null = null

  if (deliveryType === 'dine_in') {
    tableRecord = await validateTable(supabase, tenantId, body.tableId as string | undefined)
  }

  const [{ data: branchRows }, { data: zoneRows }] = await Promise.all([
    supabase.from('branches').select('id').eq('tenant_id', tenantId).eq('is_active', true),
    supabase.from('delivery_zones').select('*').eq('tenant_id', tenantId).eq('is_active', true).order('sort_order'),
  ])

  const hasZones = zoneRows && zoneRows.length > 0
  let matchedZone: DeliveryZone | null = null
  let branchId: string | null = null

  if (hasZones && deliveryType === 'delivery') {
    const geoLat = Number(body.geoLat)
    const geoLon = Number(body.geoLon)

    if (Number.isNaN(geoLat) || Number.isNaN(geoLon)) {
      throw createError({ statusCode: 400, message: 'Для доставки необходимо указать координаты адреса' })
    }

    const zones: DeliveryZone[] = (zoneRows as unknown as DeliveryZoneRow[]).map(mapDeliveryZoneRow)
    matchedZone = findDeliveryZone([geoLon, geoLat], zones)

    if (!matchedZone) {
      throw createError({ statusCode: 400, message: 'Адрес находится вне зоны доставки' })
    }

    branchId = matchedZone.branchId
  }

  // Привязка к филиалу: из body (pickup) или fallback к единственному
  if (!branchId) {
    if (deliveryType === 'pickup' && body.branchId) {
      const validBranch = branchRows?.find((b) => b.id === body.branchId)
      if (!validBranch) {
        throw createError({ statusCode: 400, message: 'Выбранный пункт самовывоза недоступен' })
      }
      branchId = body.branchId as string
    }
    else if (branchRows?.length === 1) {
      branchId = branchRows[0].id as string
    }
  }

  if (!branchId && deliveryType !== 'dine_in' && deliveryType !== 'request') {
    throw createError({ statusCode: 400, message: 'Не удалось определить филиал для заказа' })
  }

  const { deliveryFee, minOrder } = calcDeliveryFee({
    deliveryType,
    matchedZone,
    tenantDeliveryFee: tenantConfig.deliveryFee,
    tenantMinOrder: tenantConfig.deliveryMinOrder,
    subtotal,
  })

  if (deliveryType === 'delivery' && subtotal < minOrder) {
    throw createError({
      statusCode: 400,
      message: `Минимальная сумма заказа для доставки: ${minOrder} ₽`,
    })
  }

  return { matchedZone, branchId, deliveryFee, tableRecord }
}
