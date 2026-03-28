import { describe, it, expect } from 'vitest'
import { isPointInPolygon, findDeliveryZone } from '../utils/geo'
import type { DeliveryZone } from '../types/delivery-zone'

// Простой квадрат: [0,0] → [0,2] → [2,2] → [2,0]
const square: [number, number][] = [[0, 0], [0, 2], [2, 2], [2, 0]]

// Треугольник: [0,0] → [0,4] → [4,0]
const triangle: [number, number][] = [[0, 0], [0, 4], [4, 0]]

describe('isPointInPolygon', () => {
  describe('квадрат [0,0]→[2,2]', () => {
    it('центр полигона → внутри', () => {
      expect(isPointInPolygon([1, 1], square)).toBe(true)
    })

    it('точка снаружи → false', () => {
      expect(isPointInPolygon([3, 3], square)).toBe(false)
      expect(isPointInPolygon([-1, -1], square)).toBe(false)
      expect(isPointInPolygon([1, 3], square)).toBe(false)
    })

    it('точка строго за правым краем → снаружи', () => {
      expect(isPointInPolygon([2.1, 1], square)).toBe(false)
    })

    it('точка строго за левым краем → снаружи', () => {
      expect(isPointInPolygon([-0.1, 1], square)).toBe(false)
    })
  })

  describe('треугольник', () => {
    it('точка внутри треугольника', () => {
      expect(isPointInPolygon([1, 1], triangle)).toBe(true)
    })

    it('точка вне треугольника (угол)', () => {
      expect(isPointInPolygon([3, 3], triangle)).toBe(false)
    })
  })

  describe('реалистичные координаты Москвы', () => {
    // Зона вокруг центра Москвы (Красная площадь ~37.62, 55.75)
    const moscowSquare: [number, number][] = [
      [37.60, 55.73],
      [37.60, 55.77],
      [37.64, 55.77],
      [37.64, 55.73],
    ]

    it('Красная площадь внутри зоны', () => {
      expect(isPointInPolygon([37.62, 55.75], moscowSquare)).toBe(true)
    })

    it('Шереметьево за пределами зоны', () => {
      expect(isPointInPolygon([37.41, 55.97], moscowSquare)).toBe(false)
    })
  })
})

const makeZone = (overrides: Partial<DeliveryZone> = {}): DeliveryZone => ({
  id: 'zone-1',
  tenantId: 'tenant-1',
  branchId: null,
  name: 'Зона 1',
  coordinates: square,
  deliveryFee: 200,
  minOrder: 500,
  isActive: true,
  ...overrides,
})

describe('findDeliveryZone', () => {
  it('точка внутри одной зоны → возвращает эту зону', () => {
    const zone = makeZone()
    expect(findDeliveryZone([1, 1], [zone])).toBe(zone)
  })

  it('точка снаружи всех зон → null', () => {
    const zone = makeZone()
    expect(findDeliveryZone([5, 5], [zone])).toBeNull()
  })

  it('неактивная зона игнорируется', () => {
    const inactive = makeZone({ isActive: false })
    expect(findDeliveryZone([1, 1], [inactive])).toBeNull()
  })

  it('пересечение зон → выбирается самая дешёвая', () => {
    const expensive = makeZone({ id: 'zone-1', deliveryFee: 300 })
    const cheap = makeZone({ id: 'zone-2', deliveryFee: 100 })
    const result = findDeliveryZone([1, 1], [expensive, cheap])
    expect(result?.id).toBe('zone-2')
  })

  it('пересечение зон → порядок в массиве не важен', () => {
    const expensive = makeZone({ id: 'zone-1', deliveryFee: 300 })
    const cheap = makeZone({ id: 'zone-2', deliveryFee: 100 })
    const result = findDeliveryZone([1, 1], [cheap, expensive])
    expect(result?.id).toBe('zone-2')
  })

  it('одна активная + одна неактивная → возвращает активную', () => {
    const active = makeZone({ id: 'zone-1', isActive: true, deliveryFee: 500 })
    const inactive = makeZone({ id: 'zone-2', isActive: false, deliveryFee: 0 })
    const result = findDeliveryZone([1, 1], [active, inactive])
    expect(result?.id).toBe('zone-1')
  })

  it('пустой список зон → null', () => {
    expect(findDeliveryZone([1, 1], [])).toBeNull()
  })

  it('бесплатная доставка (fee=0) выигрывает', () => {
    const paid = makeZone({ id: 'paid', deliveryFee: 200 })
    const free = makeZone({ id: 'free', deliveryFee: 0 })
    expect(findDeliveryZone([1, 1], [paid, free])?.id).toBe('free')
  })
})
