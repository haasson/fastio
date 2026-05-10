import { describe, it, expect } from 'vitest'
import { mapDish } from '../api/dishes'

const makeDishRow = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: 'dish-1',
  tenant_id: 'tenant-1',
  category_id: 'cat-1',
  name: 'Бургер',
  description: 'Классический бургер',
  price: 350,
  photos: [],
  ingredients: [],
  nutrition: null,
  weight_unit: 'г',
  active: true,
  sort_order: 0,
  requires_kitchen: false,
  max_addons: null,
  ...overrides,
})

describe('mapDish', () => {
  it('маппит поля из snake_case в camelCase', () => {
    const dish = mapDish(makeDishRow())

    expect(dish.id).toBe('dish-1')
    expect(dish.tenantId).toBe('tenant-1')
    expect(dish.categoryId).toBe('cat-1')
    expect(dish.name).toBe('Бургер')
    expect(dish.description).toBe('Классический бургер')
    expect(dish.price).toBe(350)
    expect(dish.active).toBe(true)
    expect(dish.order).toBe(0)
    expect(dish.requiresKitchen).toBe(false)
  })

  it('weight_unit null → дефолтное "г"', () => {
    const dish = mapDish(makeDishRow({ weight_unit: null }))

    expect(dish.weightUnit).toBe('г')
  })

  it('max_addons null → null', () => {
    const dish = mapDish(makeDishRow({ max_addons: null }))

    expect(dish.maxAddons).toBeNull()
  })

  it('max_addons заполненный — маппится', () => {
    const dish = mapDish(makeDishRow({ max_addons: 3 }))

    expect(dish.maxAddons).toBe(3)
  })

  it('tags всегда пустой массив', () => {
    const dish = mapDish(makeDishRow())

    expect(dish.tags).toEqual([])
  })
})
