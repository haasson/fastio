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
  customers: true,
  services: true,
}

describe('resolveModules', () => {
  describe('businessType null', () => {
    it('возвращает модули без изменений', () => {
      const result = resolveModules(allEnabled, null)
      expect(result).toEqual(allEnabled)
    })
  })

  describe('businessType "retail"', () => {
    it('не выключает никакие модули', () => {
      const result = resolveModules(allEnabled, 'retail')
      expect(result).toEqual(allEnabled)
    })
  })

  describe('businessType "services"', () => {
    it('выключает delivery, pickup, dineIn, kitchen, combos, promotions, reservations, modifiers, addons', () => {
      const result = resolveModules(allEnabled, 'services')
      expect(result.delivery).toBe(false)
      expect(result.pickup).toBe(false)
      expect(result.dineIn).toBe(false)
      expect(result.kitchen).toBe(false)
      expect(result.combos).toBe(false)
      expect(result.promotions).toBe(false)
      expect(result.reservations).toBe(false)
      expect(result.modifiers).toBe(false)
      expect(result.addons).toBe(false)
    })

    it('оставляет включёнными services, branches, customRoles, customers', () => {
      const result = resolveModules(allEnabled, 'services')
      expect(result.services).toBe(true)
      expect(result.branches).toBe(true)
      expect(result.customRoles).toBe(true)
      expect(result.customers).toBe(true)
    })

    it('не мутирует исходный объект', () => {
      const input = { ...allEnabled }
      resolveModules(input, 'services')
      expect(input.delivery).toBe(true)
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
