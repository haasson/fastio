import { describe, it, expect, vi } from 'vitest'
import { useTenantLabels } from '../plan/useTenantLabels'

const mockStore: { tenant: Record<string, unknown> | null } = { tenant: null }

vi.mock('~/stores/tenant', () => ({
  useTenantStore: () => mockStore,
}))

describe('useTenantLabels', () => {
  describe('menuLabel', () => {
    it('food → "Меню"', () => {
      mockStore.tenant = { businessType: 'food' }
      expect(useTenantLabels().menuLabel.value).toBe('Меню')
    })

    it('services → "Услуги"', () => {
      mockStore.tenant = { businessType: 'services' }
      expect(useTenantLabels().menuLabel.value).toBe('Услуги')
    })

    it('retail → "Каталог"', () => {
      mockStore.tenant = { businessType: 'retail' }
      expect(useTenantLabels().menuLabel.value).toBe('Каталог')
    })

    it('null → "Каталог"', () => {
      mockStore.tenant = { businessType: null }
      expect(useTenantLabels().menuLabel.value).toBe('Каталог')
    })
  })

  describe('isServices', () => {
    it('services → true', () => {
      mockStore.tenant = { businessType: 'services' }
      expect(useTenantLabels().isServices.value).toBe(true)
    })

    it('food → false', () => {
      mockStore.tenant = { businessType: 'food' }
      expect(useTenantLabels().isServices.value).toBe(false)
    })
  })

  describe('itemLabel / itemsLabel', () => {
    it('services → "услуга" / "Услуги"', () => {
      mockStore.tenant = { businessType: 'services' }
      const { itemLabel, itemsLabel, itemsLabelLower, itemsLabelGen } = useTenantLabels()

      expect(itemLabel.value).toBe('услуга')
      expect(itemsLabel.value).toBe('Услуги')
      expect(itemsLabelLower.value).toBe('услуги')
      expect(itemsLabelGen.value).toBe('услуг')
    })

    it('food → "блюдо" / "Блюда"', () => {
      mockStore.tenant = { businessType: 'food' }
      const { itemLabel, itemsLabel, itemsLabelLower, itemsLabelGen } = useTenantLabels()

      expect(itemLabel.value).toBe('блюдо')
      expect(itemsLabel.value).toBe('Блюда')
      expect(itemsLabelLower.value).toBe('блюда')
      expect(itemsLabelGen.value).toBe('блюд')
    })

    it('retail → "блюдо" / "Блюда" (не услуги)', () => {
      mockStore.tenant = { businessType: 'retail' }
      expect(useTenantLabels().itemLabel.value).toBe('блюдо')
    })
  })
})
