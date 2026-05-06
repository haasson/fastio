import { describe, it, expect } from 'vitest'
import { mapCategory } from '../utils/menu'

const makeCategoryRow = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: 'cat-1',
  tenant_id: 'tenant-1',
  name: 'Бургеры',
  type: 'regular',
  tag_id: null,
  sort_order: 0,
  active: true,
  photo_url: null,
  use_first_dish_photo: false,
  ...overrides,
})

describe('mapCategory', () => {
  it('маппит поля из snake_case в camelCase', () => {
    const cat = mapCategory(makeCategoryRow())

    expect(cat.id).toBe('cat-1')
    expect(cat.tenantId).toBe('tenant-1')
    expect(cat.name).toBe('Бургеры')
    expect(cat.type).toBe('regular')
    expect(cat.tagId).toBeNull()
    expect(cat.order).toBe(0)
    expect(cat.active).toBe(true)
    expect(cat.photoUrl).toBeNull()
    expect(cat.useFirstDishPhoto).toBe(false)
  })

  it('type null → дефолтное "regular"', () => {
    const cat = mapCategory(makeCategoryRow({ type: null }))

    expect(cat.type).toBe('regular')
  })

  it('tag_id null → null', () => {
    const cat = mapCategory(makeCategoryRow({ tag_id: null }))

    expect(cat.tagId).toBeNull()
  })

  it('tag_id заполненный — маппится', () => {
    const cat = mapCategory(makeCategoryRow({ tag_id: 'tag-popular' }))

    expect(cat.tagId).toBe('tag-popular')
  })

  it('use_first_dish_photo null → false', () => {
    const cat = mapCategory(makeCategoryRow({ use_first_dish_photo: null }))

    expect(cat.useFirstDishPhoto).toBe(false)
  })

  it('photo_url заполненный — маппится', () => {
    const cat = mapCategory(makeCategoryRow({ photo_url: 'https://example.com/photo.jpg' }))

    expect(cat.photoUrl).toBe('https://example.com/photo.jpg')
  })
})
