import { describe, it, expect, vi } from 'vitest'
import { useTenantLabels } from '../plan/useTenantLabels'

const mockStore: { tenant: Record<string, unknown> | null } = { tenant: null }

vi.mock('~/stores/tenant', () => ({
  useTenantStore: () => mockStore,
}))

describe('useTenantLabels', () => {
  describe('menuLabel', () => {
    it('retail + food → "Меню"', () => {
      mockStore.tenant = { businessType: 'retail', menuStyle: 'food' }
      expect(useTenantLabels().menuLabel.value).toBe('Меню')
    })

    it('retail + catalog → "Каталог"', () => {
      mockStore.tenant = { businessType: 'retail', menuStyle: 'catalog' }
      expect(useTenantLabels().menuLabel.value).toBe('Каталог')
    })

    it('services → "Услуги"', () => {
      mockStore.tenant = { businessType: 'services', menuStyle: 'food' }
      expect(useTenantLabels().menuLabel.value).toBe('Услуги')
    })

    it('null businessType + food menuStyle → "Меню"', () => {
      mockStore.tenant = { businessType: null, menuStyle: 'food' }
      expect(useTenantLabels().menuLabel.value).toBe('Меню')
    })

    it('null tenant → "Меню" (default menuStyle)', () => {
      mockStore.tenant = null
      expect(useTenantLabels().menuLabel.value).toBe('Меню')
    })
  })

  describe('isServices', () => {
    it('services → true', () => {
      mockStore.tenant = { businessType: 'services' }
      expect(useTenantLabels().isServices.value).toBe(true)
    })

    it('retail → false', () => {
      mockStore.tenant = { businessType: 'retail' }
      expect(useTenantLabels().isServices.value).toBe(false)
    })
  })

  describe('itemLabel / itemsLabel', () => {
    it('services → "услуга" / "Услуги"', () => {
      mockStore.tenant = { businessType: 'services', menuStyle: 'food' }
      const { itemLabel, itemsLabel, itemsLabelLower, itemsLabelGen } = useTenantLabels()

      expect(itemLabel.value).toBe('услуга')
      expect(itemsLabel.value).toBe('Услуги')
      expect(itemsLabelLower.value).toBe('услуги')
      expect(itemsLabelGen.value).toBe('услуг')
    })

    it('retail + food → "блюдо" / "Блюда"', () => {
      mockStore.tenant = { businessType: 'retail', menuStyle: 'food' }
      const { itemLabel, itemsLabel, itemsLabelLower, itemsLabelGen } = useTenantLabels()

      expect(itemLabel.value).toBe('блюдо')
      expect(itemsLabel.value).toBe('Блюда')
      expect(itemsLabelLower.value).toBe('блюда')
      expect(itemsLabelGen.value).toBe('блюд')
    })

    it('retail + catalog → "товар" / "Товары"', () => {
      mockStore.tenant = { businessType: 'retail', menuStyle: 'catalog' }
      const { itemLabel, itemsLabel, itemsLabelLower, itemsLabelGen } = useTenantLabels()

      expect(itemLabel.value).toBe('товар')
      expect(itemsLabel.value).toBe('Товары')
      expect(itemsLabelLower.value).toBe('товары')
      expect(itemsLabelGen.value).toBe('товаров')
    })
  })

  describe('reservationsLabel', () => {
    it('services → "Запись"', () => {
      mockStore.tenant = { businessType: 'services' }
      expect(useTenantLabels().reservationsLabel.value).toBe('Запись')
    })

    it('retail → "Бронирование"', () => {
      mockStore.tenant = { businessType: 'retail' }
      expect(useTenantLabels().reservationsLabel.value).toBe('Бронирование')
    })
  })
})
