import { describe, it, expect } from 'vitest'
import { computeBranchCompat } from '../utils/branchCompat'
import type { Dish } from '@fastio/shared'
import type { DishCartItem } from '~/features/cart'

const makeDish = (id: string, branchIds: string[] = []): Dish => ({
  id,
  tenantId: 't',
  categoryId: 'c',
  name: `D${id}`,
  description: '',
  longDescription: null,
  price: 100,
  photos: [],
  ingredients: [],
  nutrition: null,
  weightUnit: 'г',
  tags: [],
  active: true,
  order: 0,
  requiresKitchen: true,
  maxAddons: null,
  branchIds,
})

const makeItem = (dishId: string): DishCartItem => ({
  kind: 'dish',
  _key: `k-${dishId}`,
  photo: null,
  dishId,
  comboId: null,
  dishName: `D${dishId}`,
  categoryName: null,
  price: 100,
  quantity: 1,
  removedIngredients: [],
  modifiers: [],
  addons: [],
  comboItems: null,
  completedAt: null,
  addedBy: null,
  confirmedBy: null,
  status: 'pending',
})

const branches = [
  { id: 'b1', name: 'Branch 1' },
  { id: 'b2', name: 'Branch 2' },
]

describe('computeBranchCompat', () => {
  it('возвращает все green когда корзина пуста', () => {
    const result = computeBranchCompat([], new Map(), branches, 2)
    expect(result).toHaveLength(2)
    expect(result.every((r) => r.status === 'green')).toBe(true)
    expect(result.every((r) => r.missingNames.length === 0)).toBe(true)
  })

  it('все филиалы green когда блюдо доступно во всех (пустой branchIds)', () => {
    const dishes = new Map([['d1', makeDish('d1', [])]])
    const result = computeBranchCompat([makeItem('d1')], dishes, branches, 2)
    expect(result.every((r) => r.status === 'green')).toBe(true)
  })

  it('все филиалы green когда branchIds.length === totalBranchCount (явно перечислили всех)', () => {
    const dishes = new Map([['d1', makeDish('d1', ['b1', 'b2'])]])
    const result = computeBranchCompat([makeItem('d1')], dishes, branches, 2)
    expect(result.every((r) => r.status === 'green')).toBe(true)
  })

  it('yellow при частичном покрытии (одно блюдо есть, другое нет)', () => {
    const dishes = new Map([
      ['d1', makeDish('d1', ['b1'])],
      ['d2', makeDish('d2', ['b2'])],
    ])
    const result = computeBranchCompat(
      [makeItem('d1'), makeItem('d2')],
      dishes,
      branches,
      2,
    )
    const b1 = result.find((r) => r.id === 'b1')!
    const b2 = result.find((r) => r.id === 'b2')!
    expect(b1.status).toBe('yellow')
    expect(b1.missingNames).toEqual(['Dd2'])
    expect(b2.status).toBe('yellow')
    expect(b2.missingNames).toEqual(['Dd1'])
  })

  it('red если ни одно блюдо не доступно в филиале', () => {
    const dishes = new Map([['d1', makeDish('d1', ['b1'])]])
    const result = computeBranchCompat([makeItem('d1')], dishes, branches, 2)
    expect(result.find((r) => r.id === 'b1')!.status).toBe('green')
    expect(result.find((r) => r.id === 'b2')!.status).toBe('red')
    expect(result.find((r) => r.id === 'b2')!.missingNames).toEqual(['Dd1'])
  })

  it('пропускает items с неизвестным dishId (реконсиляция ещё не отработала)', () => {
    const dishes = new Map([['d1', makeDish('d1', [])]])
    const result = computeBranchCompat(
      [makeItem('d1'), makeItem('unknown')],
      dishes,
      branches,
      2,
    )
    // unknown пропущен, остаётся d1 — он везде, значит все филиалы green
    expect(result.every((r) => r.status === 'green')).toBe(true)
  })

  it('смешанный сценарий: один филиал зелёный, другой жёлтый', () => {
    const dishes = new Map([
      ['d1', makeDish('d1', [])], // везде
      ['d2', makeDish('d2', ['b1'])], // только в b1
    ])
    const result = computeBranchCompat(
      [makeItem('d1'), makeItem('d2')],
      dishes,
      branches,
      2,
    )
    expect(result.find((r) => r.id === 'b1')!.status).toBe('green')
    expect(result.find((r) => r.id === 'b2')!.status).toBe('yellow')
    expect(result.find((r) => r.id === 'b2')!.missingNames).toEqual(['Dd2'])
  })
})
