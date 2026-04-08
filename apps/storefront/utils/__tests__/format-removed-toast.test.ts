import { describe, it, expect } from 'vitest'
import { formatRemovedToasts } from '../format-removed-toast'
import type { RemovedItem } from '@fastio/shared'

function makeRemoved(dishName: string, reason: RemovedItem['reason'] = 'dish_missing'): RemovedItem {
  return {
    item: { dishName } as RemovedItem['item'],
    reason,
  }
}

describe('formatRemovedToasts', () => {
  it('returns empty array for no removals', () => {
    expect(formatRemovedToasts([])).toEqual([])
  })

  it('shows dish name in title and reason in description', () => {
    const result = formatRemovedToasts([makeRemoved('Бургер')])

    expect(result).toHaveLength(1)
    expect(result[0].title).toBe('Убрано из корзины: Бургер')
    expect(result[0].description).toBe('Блюда больше нет в меню')
  })

  it('deduplicates same dish + same reason', () => {
    const result = formatRemovedToasts([
      makeRemoved('Бургер'),
      makeRemoved('Бургер'),
      makeRemoved('Бургер'),
    ])

    expect(result).toHaveLength(1)
  })

  it('shows separate toasts for different dishes', () => {
    const result = formatRemovedToasts([
      makeRemoved('Бургер'),
      makeRemoved('Пицца'),
    ])

    expect(result).toHaveLength(2)
    expect(result[0].title).toBe('Убрано из корзины: Бургер')
    expect(result[1].title).toBe('Убрано из корзины: Пицца')
  })

  it('shows modifier_invalid reason', () => {
    const result = formatRemovedToasts([makeRemoved('Бургер', 'modifier_invalid')])

    expect(result[0].description).toBe('Некоторые модификаторы больше недоступны')
  })

  it('shows addon_invalid reason', () => {
    const result = formatRemovedToasts([makeRemoved('Бургер', 'addon_invalid')])

    expect(result[0].description).toBe('Некоторые добавки больше недоступны')
  })

  it('shows combo_missing reason', () => {
    const result = formatRemovedToasts([makeRemoved('Комбо Обед', 'combo_missing')])

    expect(result[0].title).toBe('Убрано из корзины: Комбо Обед')
    expect(result[0].description).toBe('Комбо больше нет в меню')
  })

  it('same dish with different reasons produces separate toasts', () => {
    const result = formatRemovedToasts([
      makeRemoved('Бургер', 'dish_missing'),
      makeRemoved('Бургер', 'addon_invalid'),
    ])

    expect(result).toHaveLength(2)
  })
})
