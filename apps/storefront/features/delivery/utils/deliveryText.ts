import type { DeliveryZone, Tenant } from '@fastio/shared'
import { formatPrice } from '@fastio/shared'

function formatFee(fee: number, freeFrom: number, minOrder: number): string {
  if (fee === 0) return 'Бесплатная доставка'

  let text = `Доставка ${formatPrice(fee)}`
  if (freeFrom > 0) text += `, бесплатно от ${formatPrice(freeFrom)}`
  if (minOrder > 0) text += `. Минимальный заказ — ${formatPrice(minOrder)}`

  return text
}

export function buildDeliveryText(zones: DeliveryZone[], tenant: Tenant): string {
  const active = zones.filter((z) => z.isActive)

  if (active.length === 0) {
    return formatFee(tenant.deliveryFee ?? 0, 0, tenant.deliveryMinOrder ?? 0)
  }

  const firstFee = active[0].deliveryFee
  const firstFreeFrom = active[0].freeDeliveryFrom
  const uniform = active.every((z) => z.deliveryFee === firstFee && z.freeDeliveryFrom === firstFreeFrom)

  if (uniform) {
    return formatFee(firstFee, firstFreeFrom, active[0].minOrder)
  }

  return 'Стоимость доставки зависит от вашего адреса и будет уточнена при оформлении заказа'
}

export function formatZoneConditions(zone: DeliveryZone): string {
  if (zone.deliveryFee === 0) return 'Бесплатная доставка'

  let text = `Доставка ${formatPrice(zone.deliveryFee)}`
  if (zone.freeDeliveryFrom > 0) text += `, бесплатно от ${formatPrice(zone.freeDeliveryFrom)}`
  if (zone.minOrder > 0) text += `\nМинимальный заказ — ${formatPrice(zone.minOrder)}`

  return text
}
