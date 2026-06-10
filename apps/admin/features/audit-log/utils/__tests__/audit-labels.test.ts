import { describe, it, expect } from 'vitest'
import {
  entityTypeLabel,
  actionMeta,
  fieldLabel,
  formatFieldValue,
  renderChanges,
  ENTITY_TYPE_LABELS,
  ENTITY_TYPE_GROUPS,
} from '../audit-labels'

describe('entityTypeLabel', () => {
  it('маппит известные типы на русский', () => {
    expect(entityTypeLabel('dish')).toBe('Блюдо')
    expect(entityTypeLabel('modifier_option')).toBe('Опция модификатора')
    expect(entityTypeLabel('promo_code')).toBe('Промокод')
    expect(entityTypeLabel('order')).toBe('Заказ')
  })

  it('возвращает исходный код для неизвестного типа', () => {
    expect(entityTypeLabel('unknown_thing')).toBe('unknown_thing')
  })
})

describe('ENTITY_TYPE_GROUPS', () => {
  it('покрывает все типы из ENTITY_TYPE_LABELS без дублей', () => {
    const grouped = ENTITY_TYPE_GROUPS.flatMap((g) => g.types)

    expect(new Set(grouped).size).toBe(grouped.length) // нет дублей
    expect([...grouped].sort()).toEqual(Object.keys(ENTITY_TYPE_LABELS).sort()) // покрытие 1:1
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

  it('enum-значения переводятся при известном поле', () => {
    expect(formatFieldValue('circle', 'shape')).toBe('Круглый')
    expect(formatFieldValue('confirmed', 'status', 'reservation')).toBe('Подтверждена')
    expect(formatFieldValue('combo', 'type', 'category')).toBe('Комбо')
    expect(formatFieldValue('min_order', 'type', 'promotion')).toBe('Минимальная сумма')
  })

  it('неизвестное enum-значение или без поля → как есть', () => {
    expect(formatFieldValue('weird', 'status', 'reservation')).toBe('weird')
    expect(formatFieldValue('confirmed')).toBe('confirmed')
  })
})

describe('renderChanges', () => {
  it('строит дифф из changedFields + payload, цена → kind=price с направлением', () => {
    const result = renderChanges({
      entityType: 'dish',
      changedFields: ['price'],
      payload: { price: { old: 500, new: 650 } },
    })

    expect(result).toEqual([
      { field: 'price', label: 'Цена', oldValue: '500', newValue: '650', kind: 'price', direction: 'up' },
    ])
  })

  it('цена вниз → direction=down', () => {
    const result = renderChanges({
      entityType: 'dish',
      changedFields: ['price'],
      payload: { price: { old: 650, new: 500 } },
    })

    expect(result[0].direction).toBe('down')
  })

  it('jsonb-объект разворачивается в значимые листья', () => {
    const result = renderChanges({
      entityType: 'dish',
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
      entityType: 'settings',
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

    const result = renderChanges({ entityType: 'settings', changedFields: ['theme'], payload: { theme: { old, new: next } } })

    expect(result).toHaveLength(1)
    expect(result[0].kind).toBe('complex')
  })

  it('отбрасывает технические поля soft-delete', () => {
    const result = renderChanges({
      entityType: 'dish',
      changedFields: ['deleted_at', 'archived_at'],
      payload: { deleted_at: { old: null, new: '2026-06-09' } },
    })

    expect(result).toHaveLength(0)
  })

  it('подставляет тире, если в payload нет diff-структуры', () => {
    const result = renderChanges({
      entityType: 'dish',
      changedFields: ['name'],
      payload: {},
    })

    expect(result[0]).toEqual({ field: 'name', label: 'Название', oldValue: '—', newValue: '—', kind: 'text', direction: null })
  })

  it('пустой changedFields → пустой массив', () => {
    expect(renderChanges({ entityType: 'dish', changedFields: [], payload: {} })).toEqual([])
  })

  it('переводит enum-значения полей на русский (status брони)', () => {
    const result = renderChanges({
      entityType: 'reservation',
      changedFields: ['status'],
      payload: { status: { old: 'pending', new: 'confirmed' } },
    })

    expect(result[0]).toMatchObject({ label: 'Статус', oldValue: 'Ожидает', newValue: 'Подтверждена' })
  })

  it('прячет поля, дублирующие колонки: confirmed_at (дата) и confirmed_by (кто)', () => {
    const result = renderChanges({
      entityType: 'reservation',
      changedFields: ['status', 'confirmed_at', 'confirmed_by'],
      payload: {
        status: { old: 'pending', new: 'confirmed' },
        confirmed_at: { old: null, new: '2026-06-09T19:01:00.000Z' },
        confirmed_by: { old: null, new: '00000000-0000-0000-0000-000000000001' },
      },
    })

    // остаётся только смена статуса; confirmed_at и confirmed_by скрыты
    expect(result).toEqual([
      { field: 'status', label: 'Статус', oldValue: 'Ожидает', newValue: 'Подтверждена', kind: 'text', direction: null },
    ])
  })

  it('не перебарщивает: cancelled_at скрыт (момент действия), а cancel_reason остаётся (данные)', () => {
    const result = renderChanges({
      entityType: 'reservation',
      changedFields: ['cancelled_at', 'cancel_reason'],
      payload: {
        cancelled_at: { old: null, new: '2026-06-09T19:01:00.000Z' },
        cancel_reason: { old: null, new: 'гость не пришёл' },
      },
    })

    expect(result).toEqual([
      { field: 'cancel_reason', label: 'Причина отмены', oldValue: '—', newValue: 'гость не пришёл', kind: 'text', direction: null },
    ])
  })

  it('enum `type` разводится по entity_type (конфликт категория/акция)', () => {
    const category = renderChanges({
      entityType: 'category',
      changedFields: ['type'],
      payload: { type: { old: 'regular', new: 'combo' } },
    })
    const promotion = renderChanges({
      entityType: 'promotion',
      changedFields: ['type'],
      payload: { type: { old: 'min_order', new: 'happy_hour' } },
    })

    expect(category[0]).toMatchObject({ oldValue: 'Обычная', newValue: 'Комбо' })
    expect(promotion[0]).toMatchObject({ oldValue: 'Минимальная сумма', newValue: 'Счастливые часы' })
  })

  it('открытие стола → фраза «Стол открыт», opened_at скрыт', () => {
    const result = renderChanges({
      entityType: 'table',
      changedFields: ['is_open', 'opened_at'],
      payload: { is_open: { old: false, new: true }, opened_at: { old: null, new: '2026-06-10T04:20:35.911247+00:00' } },
    })

    expect(result).toEqual([
      { field: 'is_open', label: 'Стол открыт', oldValue: '', newValue: '', kind: 'phrase', direction: null },
    ])
  })

  it('закрытие стола → фраза «Стол закрыт»', () => {
    const result = renderChanges({
      entityType: 'table',
      changedFields: ['is_open', 'opened_at'],
      payload: { is_open: { old: true, new: false }, opened_at: { old: '2026-06-10T04:20:35.911247+00:00', new: null } },
    })

    expect(result).toEqual([
      { field: 'is_open', label: 'Стол закрыт', oldValue: '', newValue: '', kind: 'phrase', direction: null },
    ])
  })

  it('прочие правки стола рядом с открытием рендерятся как обычно', () => {
    const result = renderChanges({
      entityType: 'table',
      changedFields: ['is_open', 'name'],
      payload: { is_open: { old: false, new: true }, name: { old: 'Стол 1', new: 'Стол 5' } },
    })

    expect(result).toEqual([
      { field: 'is_open', label: 'Стол открыт', oldValue: '', newValue: '', kind: 'phrase', direction: null },
      { field: 'name', label: 'Название', oldValue: 'Стол 1', newValue: 'Стол 5', kind: 'text', direction: null },
    ])
  })

  it('is_open без diff-структуры → фразу не подставляем (фолбэк к обычному рендеру)', () => {
    const result = renderChanges({
      entityType: 'table',
      changedFields: ['is_open'],
      payload: {},
    })

    expect(result[0].kind).not.toBe('phrase')
  })
})

describe('formatFieldValue — таймстемпы', () => {
  it('полный ISO-таймстемп форматируется человечно (не сырой ISO)', () => {
    const raw = '2026-06-10T04:20:35.911247+00:00'
    const out = formatFieldValue(raw, 'opened_at', 'table')

    expect(out).not.toBe(raw)
    expect(out).not.toContain('T')
    expect(out).not.toContain('911247')
  })

  it('голая дата (без времени) не трогается таймстемп-форматтером', () => {
    expect(formatFieldValue('2026-06-10', 'reserved_date', 'reservation')).toBe('2026-06-10')
  })
})
