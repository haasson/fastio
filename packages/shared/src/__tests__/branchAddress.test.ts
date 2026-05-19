import { describe, it, expect } from 'vitest'
import { formatBranchAddressShort } from '../utils/branchAddress'
import type { BranchAddressData } from '../types/branch'

const makeAddressData = (overrides: Partial<BranchAddressData> = {}): BranchAddressData => ({
  value: 'г. Москва, ул. Ленина, д. 1',
  geo_lat: null,
  geo_lon: null,
  qc_geo: null,
  region_with_type: 'г. Москва',
  area_with_type: null,
  city_with_type: 'г. Москва',
  settlement_with_type: null,
  street_with_type: 'ул. Ленина',
  house_type: 'д.',
  house: '1',
  block_type: null,
  block: null,
  flat_type: null,
  flat: null,
  postal_code: '101000',
  fias_id: null,
  city_fias_id: null,
  qc: null,
  city: 'Москва',
  street: 'Ленина',
  ...overrides,
})

describe('formatBranchAddressShort', () => {
  it('стандартный адрес: улица + дом с типом', () => {
    const result = formatBranchAddressShort({
      address: 'Москва, ул. Ленина, д. 1',
      addressData: makeAddressData(),
    })

    expect(result).toBe('ул. Ленина, д. 1')
  })

  it('используется street_with_type если есть, а не поле street', () => {
    const result = formatBranchAddressShort({
      address: 'fallback',
      addressData: makeAddressData({ street_with_type: 'пр-т Мира', street: 'ул. Старая' }),
    })

    expect(result).toContain('пр-т Мира')
    expect(result).not.toContain('ул. Старая')
  })

  it('если нет street_with_type — использует street', () => {
    const result = formatBranchAddressShort({
      address: 'fallback',
      addressData: makeAddressData({ street_with_type: null, street: 'Ленина' }),
    })

    expect(result).toContain('Ленина')
  })

  it('дом без типа — только номер', () => {
    const result = formatBranchAddressShort({
      address: 'fallback',
      addressData: makeAddressData({ house_type: null, house: '42' }),
    })

    expect(result).toContain('42')
    expect(result).not.toContain('д.')
  })

  it('корпус добавляется к адресу', () => {
    const result = formatBranchAddressShort({
      address: 'fallback',
      addressData: makeAddressData({ block_type: 'корп.', block: '3' }),
    })

    expect(result).toContain('корп. 3')
  })

  it('квартира добавляется к адресу', () => {
    const result = formatBranchAddressShort({
      address: 'fallback',
      addressData: makeAddressData({ flat_type: 'кв.', flat: '15' }),
    })

    expect(result).toContain('кв. 15')
  })

  it('если нет ни улицы, ни дома — возвращает исходный address как fallback', () => {
    const result = formatBranchAddressShort({
      address: 'г. Москва, ТЦ Мега',
      addressData: makeAddressData({ street_with_type: null, street: null, house: null }),
    })

    expect(result).toBe('г. Москва, ТЦ Мега')
  })

  it('полный адрес с улицей, домом, корпусом и квартирой', () => {
    const result = formatBranchAddressShort({
      address: 'fallback',
      addressData: makeAddressData({
        street_with_type: 'ул. Пушкина',
        house_type: 'д.',
        house: '10',
        block_type: 'корп.',
        block: '2',
        flat_type: 'кв.',
        flat: '5',
      }),
    })

    expect(result).toBe('ул. Пушкина, д. 10, корп. 2, кв. 5')
  })
})
