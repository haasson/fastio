import type { DeliveryZone } from '../types/delivery-zone'

/**
 * Ray casting — проверяет, находится ли точка внутри полигона.
 * Координаты в формате [lng, lat].
 */
export const isPointInPolygon = (
  point: [number, number],
  polygon: [number, number][],
): boolean => {
  const [x, y] = point
  let inside = false

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i]
    const [xj, yj] = polygon[j]

    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside
    }
  }

  return inside
}

/**
 * Находит первую активную зону, в которую попадает точка.
 * Зоны проверяются в порядке sortOrder (массив должен быть уже отсортирован).
 */
export const findDeliveryZone = (
  point: [number, number],
  zones: DeliveryZone[],
): DeliveryZone | null => {
  for (const zone of zones) {
    if (!zone.isActive) continue
    if (isPointInPolygon(point, zone.coordinates)) return zone
  }

  return null
}
