import { describe, it, expect } from 'vitest'
import { getItemUnitPrice } from '../utils/price'

describe('getItemUnitPrice', () => {
  it('блюдо без модификаторов и аддонов — возвращает price', () => {
    expect(getItemUnitPrice({ price: 300 })).toBe(300)
  })

  it('с пустыми массивами — возвращает price', () => {
    expect(getItemUnitPrice({ price: 300, modifiers: [], addons: [] })).toBe(300)
  })

  it('с модификатором +50', () => {
    expect(getItemUnitPrice({ price: 300, modifiers: [{ priceDelta: 50 }] })).toBe(350)
  })

  it('с аддоном +30', () => {
    expect(getItemUnitPrice({ price: 300, addons: [{ price: 30 }] })).toBe(330)
  })

  it('с модификатором +50 и аддоном +30', () => {
    expect(getItemUnitPrice({
      price: 300,
      modifiers: [{ priceDelta: 50 }],
      addons: [{ price: 30 }],
    })).toBe(380)
  })

  it('несколько модификаторов и аддонов', () => {
    expect(getItemUnitPrice({
      price: 200,
      modifiers: [{ priceDelta: 10 }, { priceDelta: 20 }],
      addons: [{ price: 15 }, { price: 5 }],
    })).toBe(250)
  })

  it('модификатор с отрицательным delta', () => {
    expect(getItemUnitPrice({ price: 300, modifiers: [{ priceDelta: -50 }] })).toBe(250)
  })

  it('undefined modifiers и addons — не падает', () => {
    expect(getItemUnitPrice({ price: 300, modifiers: undefined, addons: undefined })).toBe(300)
  })
})
