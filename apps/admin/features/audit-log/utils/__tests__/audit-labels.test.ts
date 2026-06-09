import { describe, it, expect } from 'vitest'
import {
  entityTypeLabel,
  actionMeta,
  fieldLabel,
  formatFieldValue,
  renderChanges,
} from '../audit-labels'

describe('entityTypeLabel', () => {
  it('маппит известные типы на русский', () => {
    expect(entityTypeLabel('dish')).toBe('Блюдо')
    expect(entityTypeLabel('modifier_option')).toBe('Опция модификатора')
    expect(entityTypeLabel('promo_code')).toBe('Промокод')
  })

  it('возвращает исходный код для неизвестного типа', () => {
    expect(entityTypeLabel('unknown_thing')).toBe('unknown_thing')
  })
})

describe('actionMeta', () => {
  it('даёт лейбл и тон для известных действий', () => {
    expect(actionMeta('created')).toEqual({ label: 'Создано', tone: 'success' })
    expect(actionMeta('deleted')).toEqual({ label: 'Удалено', tone: 'error' })
    expect(actionMeta('updated').tone).toBe('primary')
  })

  it('фолбэк на default-тон для неизвестного действия', () => {
    expect(actionMeta('frobnicated')).toEqual({ label: 'frobnicated', tone: 'default' })
  })
})

describe('fieldLabel', () => {
  it('маппит ключи полей на русский', () => {
    expect(fieldLabel('price')).toBe('Цена')
    expect(fieldLabel('blocked_until')).toBe('Блокировка')
    expect(fieldLabel('role_id')).toBe('Роль')
  })

  it('возвращает ключ как есть, если неизвестен', () => {
    expect(fieldLabel('weird_column')).toBe('weird_column')
  })
})

describe('formatFieldValue', () => {
  it('пустые значения → тире', () => {
    expect(formatFieldValue(null)).toBe('—')
    expect(formatFieldValue(undefined)).toBe('—')
    expect(formatFieldValue('')).toBe('—')
  })

  it('булевы → да/нет', () => {
    expect(formatFieldValue(true)).toBe('да')
    expect(formatFieldValue(false)).toBe('нет')
  })

  it('массивы → количество', () => {
    expect(formatFieldValue(['a', 'b'])).toBe('2 шт.')
    expect(formatFieldValue([])).toBe('—')
  })

  it('числа и строки — как есть', () => {
    expect(formatFieldValue(650)).toBe('650')
    expect(formatFieldValue('Маргарита')).toBe('Маргарита')
  })
})

describe('renderChanges', () => {
  it('строит дифф из changedFields + payload, цена → kind=price с направлением', () => {
    const result = renderChanges({
      changedFields: ['price'],
      payload: { price: { old: 500, new: 650 } },
    })

    expect(result).toEqual([
      { field: 'price', label: 'Цена', oldValue: '500', newValue: '650', kind: 'price', direction: 'up' },
    ])
  })

  it('цена вниз → direction=down', () => {
    const result = renderChanges({
      changedFields: ['price'],
      payload: { price: { old: 650, new: 500 } },
    })

    expect(result[0].direction).toBe('down')
  })

  it('jsonb-объект разворачивается в значимые листья', () => {
    const result = renderChanges({
      changedFields: ['nutrition'],
      payload: { nutrition: { old: { calories: 100, protein: 5 }, new: { calories: 200, protein: 5 } } },
    })

    // protein не изменился — отфильтрован; calories развёрнут как лист
    expect(result).toEqual([
      { field: 'nutrition.calories', label: 'Пищевая ценность › Калории', oldValue: '100', newValue: '200', kind: 'text', direction: null },
    ])
  })

  it('булевы вложенные значения (модули) → да/нет', () => {
    const result = renderChanges({
      changedFields: ['modules'],
      payload: { modules: { old: { delivery: true }, new: { delivery: false } } },
    })

    expect(result[0]).toMatchObject({ label: 'Модули › Доставка', oldValue: 'да', newValue: 'нет' })
  })

  it('слишком большой/непрозрачный объект → фолбэк complex', () => {
    const old: Record<string, number> = {}
    const next: Record<string, number> = {}

    for (let i = 0; i < 12; i++) {
      old[`k${i}`] = i
      next[`k${i}`] = i + 1
    }

    const result = renderChanges({ changedFields: ['theme'], payload: { theme: { old, new: next } } })

    expect(result).toHaveLength(1)
    expect(result[0].kind).toBe('complex')
  })

  it('отбрасывает технические поля soft-delete', () => {
    const result = renderChanges({
      changedFields: ['deleted_at', 'archived_at'],
      payload: { deleted_at: { old: null, new: '2026-06-09' } },
    })

    expect(result).toHaveLength(0)
  })

  it('подставляет тире, если в payload нет diff-структуры', () => {
    const result = renderChanges({
      changedFields: ['name'],
      payload: {},
    })

    expect(result[0]).toEqual({ field: 'name', label: 'Название', oldValue: '—', newValue: '—', kind: 'text', direction: null })
  })

  it('пустой changedFields → пустой массив', () => {
    expect(renderChanges({ changedFields: [], payload: {} })).toEqual([])
  })
})
