import type { BranchAddressData } from '../types/branch'

/**
 * Короткий адрес филиала для витрины: «улица + дом + корпус + квартира».
 * Без региона/города/индекса — клиент уже на сайте конкретного заведения,
 * город он знает; ему важен только конкретный адрес точки.
 *
 * Если структурного адреса нет (старые филиалы до миграции 244, у которых
 * address_data = {value}) — возвращает полный display value как fallback.
 */
export function formatBranchAddressShort(input: { address: string; addressData: BranchAddressData }): string {
  const d = input.addressData
  const parts: string[] = []

  if (d.street_with_type) parts.push(d.street_with_type)
  else if (d.street) parts.push(d.street)

  if (d.house) parts.push(d.house_type ? `${d.house_type} ${d.house}` : d.house)
  if (d.block) parts.push(d.block_type ? `${d.block_type} ${d.block}` : d.block)
  if (d.flat) parts.push(d.flat_type ? `${d.flat_type} ${d.flat}` : d.flat)

  if (parts.length === 0) return input.address

  return parts.join(', ')
}
