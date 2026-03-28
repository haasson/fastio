import { describe, it, expect } from 'vitest'
import { orderItemKey } from '../utils/orderItemKey'

describe('orderItemKey', () => {
  it('всё пустое → разделители без контента', () => {
    expect(orderItemKey([], [], [])).toBe('||')
  })

  it('только модификаторы', () => {
    const key = orderItemKey([{ optionName: 'Острый', optionId: '1', priceDelta: 0 }], [], [])
    expect(key).toBe('Острый||')
  })

  it('только аддоны', () => {
    const key = orderItemKey([], [{ addonName: 'Соус', addonId: '1', price: 0 }], [])
    expect(key).toBe('|Соус|')
  })

  it('только убранные ингредиенты', () => {
    expect(orderItemKey([], [], ['огурцы'])).toBe('||огурцы')
  })

  it('все три группы', () => {
    const key = orderItemKey(
      [{ optionName: 'Острый', optionId: '1', priceDelta: 0 }],
      [{ addonName: 'Соус', addonId: '1', price: 0 }],
      ['огурцы'],
    )
    expect(key).toBe('Острый|Соус|огурцы')
  })

  it('модификаторы сортируются', () => {
    const key = orderItemKey(
      [
        { optionName: 'Средний', optionId: '2', priceDelta: 0 },
        { optionName: 'Большой', optionId: '1', priceDelta: 0 },
      ],
      [],
      [],
    )
    expect(key).toBe('Большой,Средний||')
  })

  it('аддоны сортируются', () => {
    const key = orderItemKey(
      [],
      [
        { addonName: 'Сыр', addonId: '2', price: 0 },
        { addonName: 'Бекон', addonId: '1', price: 0 },
      ],
      [],
    )
    expect(key).toBe('|Бекон,Сыр|')
  })

  it('убранные ингредиенты сортируются', () => {
    expect(orderItemKey([], [], ['томаты', 'лук'])).toBe('||лук,томаты')
  })

  it('одинаковые опции → одинаковый ключ вне зависимости от порядка', () => {
    const key1 = orderItemKey(
      [{ optionName: 'A', optionId: '1', priceDelta: 0 }, { optionName: 'B', optionId: '2', priceDelta: 0 }],
      [],
      [],
    )
    const key2 = orderItemKey(
      [{ optionName: 'B', optionId: '2', priceDelta: 0 }, { optionName: 'A', optionId: '1', priceDelta: 0 }],
      [],
      [],
    )
    expect(key1).toBe(key2)
  })
})
