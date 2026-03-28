import { describe, it, expect } from 'vitest'
import { resolveModules } from '../utils/resolveModules'
import type { TenantModules } from '../types/tenant'

const allEnabled: TenantModules = {
  delivery: true,
  pickup: true,
  dineIn: true,
  modifiers: true,
  addons: true,
  promotions: true,
  combos: true,
  kitchen: true,
  branches: true,
  customRoles: true,
  reservations: true,
}

describe('resolveModules', () => {
  describe('businessType null', () => {
    it('возвращает модули без изменений', () => {
      const result = resolveModules(allEnabled, null)
      expect(result).toEqual(allEnabled)
    })
  })

  describe('businessType "food"', () => {
    it('не выключает никакие модули', () => {
      const result = resolveModules(allEnabled, 'food')
      expect(result).toEqual(allEnabled)
    })
  })

  describe('businessType "services"', () => {
    it('выключает delivery, pickup, dineIn, kitchen, combos, promotions', () => {
      const result = resolveModules(allEnabled, 'services')
      expect(result.delivery).toBe(false)
      expect(result.pickup).toBe(false)
      expect(result.dineIn).toBe(false)
      expect(result.kitchen).toBe(false)
      expect(result.combos).toBe(false)
      expect(result.promotions).toBe(false)
    })

    it('оставляет включёнными modifiers, addons, branches, reservations, customRoles', () => {
      const result = resolveModules(allEnabled, 'services')
      expect(result.modifiers).toBe(true)
      expect(result.addons).toBe(true)
      expect(result.branches).toBe(true)
      expect(result.reservations).toBe(true)
      expect(result.customRoles).toBe(true)
    })

    it('не мутирует исходный объект', () => {
      const input = { ...allEnabled }
      resolveModules(input, 'services')
      expect(input.delivery).toBe(true)
    })
  })

  describe('businessType "retail"', () => {
    it('выключает dineIn, kitchen, reservations', () => {
      const result = resolveModules(allEnabled, 'retail')
      expect(result.dineIn).toBe(false)
      expect(result.kitchen).toBe(false)
      expect(result.reservations).toBe(false)
    })

    it('оставляет включёнными delivery, pickup, promotions, combos', () => {
      const result = resolveModules(allEnabled, 'retail')
      expect(result.delivery).toBe(true)
      expect(result.pickup).toBe(true)
      expect(result.promotions).toBe(true)
      expect(result.combos).toBe(true)
    })
  })

  describe('уже выключенные модули', () => {
    it('выключенный модуль остаётся выключенным', () => {
      const partial = { ...allEnabled, delivery: false }
      const result = resolveModules(partial, 'services')
      expect(result.delivery).toBe(false)
    })
  })
})
