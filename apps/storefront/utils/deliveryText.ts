import type { DeliveryZone, Tenant } from '@fastio/shared'

function formatFee(fee: number, freeFrom: number, minOrder: number, currency: string): string {
  if (fee === 0) return 'Бесплатная доставка'

  let text = `Доставка\u00a0${fee}\u00a0${currency}`
  if (freeFrom > 0) text += `, бесплатно от\u00a0${freeFrom}\u00a0${currency}`
  if (minOrder > 0) text += `. Минимальный заказ\u00a0—\u00a0${minOrder}\u00a0${currency}`

  return text
}

export function buildDeliveryText(zones: DeliveryZone[], tenant: Tenant, currency: string): string {
  const active = zones.filter((z) => z.isActive)

  if (active.length === 0) {
    return formatFee(tenant.deliveryFee ?? 0, 0, tenant.deliveryMinOrder ?? 0, currency)
  }

  const firstFee = active[0].deliveryFee
  const firstFreeFrom = active[0].freeDeliveryFrom
  const uniform = active.every((z) => z.deliveryFee === firstFee && z.freeDeliveryFrom === firstFreeFrom)

  if (uniform) {
    return formatFee(firstFee, firstFreeFrom, active[0].minOrder, currency)
  }

  return 'Стоимость доставки зависит от вашего адреса и будет уточнена при оформлении заказа'
}

export function formatZoneConditions(zone: DeliveryZone, currency: string): string {
  if (zone.deliveryFee === 0) return 'Бесплатная доставка'

  let text = `Доставка\u00a0${zone.deliveryFee}\u00a0${currency}`
  if (zone.freeDeliveryFrom > 0) text += `, бесплатно от\u00a0${zone.freeDeliveryFrom}\u00a0${currency}`
  if (zone.minOrder > 0) text += `\nМинимальный заказ\u00a0—\u00a0${zone.minOrder}\u00a0${currency}`

  return text
}
