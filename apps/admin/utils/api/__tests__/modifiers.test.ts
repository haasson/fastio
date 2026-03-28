import { describe, it, expect } from 'vitest'
import { mapModifierGroup, mapModifierOption } from '../modifiers'

const makeOptionRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'opt-1',
  group_id: 'group-1',
  name: 'Острый',
  sort_order: 0,
  active: true,
  weight: null,
  ...overrides,
})

const makeGroupRow = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: 'group-1',
  tenant_id: 'tenant-1',
  name: 'Степень остроты',
  sort_order: 0,
  active: true,
  affects_weight: false,
  weight_mode: 'per_dish',
  deleted_at: null,
  created_at: '2026-01-01T00:00:00Z',
  modifier_options: [],
  ...overrides,
})

describe('mapModifierOption', () => {
  it('маппит базовые поля', () => {
    const opt = mapModifierOption(makeOptionRow())

    expect(opt.id).toBe('opt-1')
    expect(opt.groupId).toBe('group-1')
    expect(opt.name).toBe('Острый')
    expect(opt.sortOrder).toBe(0)
    expect(opt.active).toBe(true)
  })

  it('weight null → null', () => {
    expect(mapModifierOption(makeOptionRow({ weight: null })).weight).toBeNull()
  })

  it('weight заполненный — маппится', () => {
    expect(mapModifierOption(makeOptionRow({ weight: 150 })).weight).toBe(150)
  })
})

describe('mapModifierGroup', () => {
  it('маппит базовые поля', () => {
    const group = mapModifierGroup(makeGroupRow())

    expect(group.id).toBe('group-1')
    expect(group.tenantId).toBe('tenant-1')
    expect(group.name).toBe('Степень остроты')
    expect(group.sortOrder).toBe(0)
    expect(group.active).toBe(true)
  })

  it('affects_weight null → false', () => {
    expect(mapModifierGroup(makeGroupRow({ affects_weight: null })).affectsWeight).toBe(false)
  })

  it('weight_mode null → "per_dish"', () => {
    expect(mapModifierGroup(makeGroupRow({ weight_mode: null })).weightMode).toBe('per_dish')
  })

  it('weight_mode "global" — маппится', () => {
    expect(mapModifierGroup(makeGroupRow({ weight_mode: 'global' })).weightMode).toBe('global')
  })

  it('modifier_options null → пустой массив', () => {
    expect(mapModifierGroup(makeGroupRow({ modifier_options: null })).options).toEqual([])
  })

  it('modifier_options маппятся через mapModifierOption', () => {
    const group = mapModifierGroup(makeGroupRow({
      modifier_options: [
        makeOptionRow({ id: 'opt-1', name: 'Слабо' }),
        makeOptionRow({ id: 'opt-2', name: 'Сильно' }),
      ],
    }))

    expect(group.options).toHaveLength(2)
    expect(group.options[0].name).toBe('Слабо')
    expect(group.options[1].name).toBe('Сильно')
  })
})
