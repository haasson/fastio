import { describe, it, expect } from 'vitest'
import { mapService } from '../utils/service'

const makeServiceRow = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: 'svc-1',
  tenant_id: 'tenant-1',
  category_id: 'cat-1',
  name: 'Стрижка',
  description: 'Обычная стрижка',
  price: 1500,
  duration: 60,
  photos: [],
  tags: [],
  is_bookable: true,
  booking_mode: 'fixed',
  max_duration: null,
  allow_resource_choice: true,
  active: true,
  sort_order: 0,
  long_description: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  ...overrides,
})

describe('mapService', () => {
  it('маппит все базовые поля из snake_case в camelCase', () => {
    const s = mapService(makeServiceRow())

    expect(s.id).toBe('svc-1')
    expect(s.tenantId).toBe('tenant-1')
    expect(s.categoryId).toBe('cat-1')
    expect(s.name).toBe('Стрижка')
    expect(s.description).toBe('Обычная стрижка')
    expect(s.price).toBe(1500)
    expect(s.duration).toBe(60)
    expect(s.isBookable).toBe(true)
    expect(s.bookingMode).toBe('fixed')
    expect(s.active).toBe(true)
    expect(s.sortOrder).toBe(0)
    expect(s.createdAt).toBe('2026-01-01T00:00:00Z')
    expect(s.updatedAt).toBe('2026-01-01T00:00:00Z')
  })

  it('category_id null → null', () => {
    const s = mapService(makeServiceRow({ category_id: null }))

    expect(s.categoryId).toBeNull()
  })

  it('description null/undefined → пустая строка', () => {
    const s = mapService(makeServiceRow({ description: null }))

    expect(s.description).toBe('')
  })

  it('photos null → пустой массив', () => {
    const s = mapService(makeServiceRow({ photos: null }))

    expect(s.photos).toEqual([])
  })

  it('photos с элементами — маппятся', () => {
    const s = mapService(makeServiceRow({ photos: ['url1', 'url2'] }))

    expect(s.photos).toEqual(['url1', 'url2'])
  })

  it('tags null → пустой массив', () => {
    const s = mapService(makeServiceRow({ tags: null }))

    expect(s.tags).toEqual([])
  })

  it('booking_mode null → "fixed" (дефолт)', () => {
    const s = mapService(makeServiceRow({ booking_mode: null }))

    expect(s.bookingMode).toBe('fixed')
  })

  it('booking_mode="variable" маппится', () => {
    const s = mapService(makeServiceRow({ booking_mode: 'variable' }))

    expect(s.bookingMode).toBe('variable')
  })

  it('max_duration null → null', () => {
    const s = mapService(makeServiceRow({ max_duration: null }))

    expect(s.maxDuration).toBeNull()
  })

  it('max_duration 120 — маппится', () => {
    const s = mapService(makeServiceRow({ max_duration: 120 }))

    expect(s.maxDuration).toBe(120)
  })

  it('allow_resource_choice null → true (дефолт)', () => {
    const s = mapService(makeServiceRow({ allow_resource_choice: null }))

    expect(s.allowResourceChoice).toBe(true)
  })

  it('long_description null → null', () => {
    const s = mapService(makeServiceRow({ long_description: null }))

    expect(s.longDescription).toBeNull()
  })

  it('long_description заполнен — маппится', () => {
    const s = mapService(makeServiceRow({ long_description: 'Подробное описание услуги' }))

    expect(s.longDescription).toBe('Подробное описание услуги')
  })

  it('active=false — маппится', () => {
    const s = mapService(makeServiceRow({ active: false }))

    expect(s.active).toBe(false)
  })
})
