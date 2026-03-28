import { describe, it, expect } from 'vitest'
import {
  featureLabel,
  isFeatureAvailable,
  SECTION_KEYS,
  NAV_PAGE_KEYS,
  PAGE_KEYS,
  STRUCTURAL_SECTIONS,
} from '../utils/siteFeatures'
import type { TenantModules } from '../types/tenant'

const allModules: TenantModules = {
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

describe('featureLabel', () => {
  it('возвращает стандартный label', () => {
    expect(featureLabel('gallery')).toBe('Галерея')
    expect(featureLabel('delivery')).toBe('Доставка')
    expect(featureLabel('about')).toBe('О нас')
  })

  it('services + servicesLabel → возвращает servicesLabel', () => {
    expect(featureLabel('menu', 'services')).toBe('Услуги')
    expect(featureLabel('categoryBar', 'services')).toBe('Панель категорий услуг')
  })

  it('services + нет servicesLabel → стандартный label', () => {
    expect(featureLabel('gallery', 'services')).toBe('Галерея')
    expect(featureLabel('delivery', 'services')).toBe('Доставка')
  })

  it('food → стандартный label', () => {
    expect(featureLabel('menu', 'food')).toBe('Меню')
  })

  it('null businessType → стандартный label', () => {
    expect(featureLabel('menu', null)).toBe('Меню')
  })

  it('неизвестный ключ → возвращает ключ как есть', () => {
    expect(featureLabel('unknown_feature')).toBe('unknown_feature')
  })
})

describe('isFeatureAvailable', () => {
  describe('фичи без обязательного модуля', () => {
    it('gallery — всегда доступна', () => {
      const noModules = { ...allModules, delivery: false, reservations: false }
      expect(isFeatureAvailable('gallery', noModules)).toBe(true)
    })

    it('about — всегда доступна', () => {
      expect(isFeatureAvailable('about', allModules)).toBe(true)
    })

    it('menu — всегда доступна', () => {
      expect(isFeatureAvailable('menu', allModules)).toBe(true)
    })
  })

  describe('фичи с обязательным модулем', () => {
    it('delivery: модуль включён → доступна', () => {
      expect(isFeatureAvailable('delivery', { ...allModules, delivery: true })).toBe(true)
    })

    it('delivery: модуль выключен → недоступна', () => {
      expect(isFeatureAvailable('delivery', { ...allModules, delivery: false })).toBe(false)
    })

    it('booking: reservations включены → доступна', () => {
      expect(isFeatureAvailable('booking', { ...allModules, reservations: true })).toBe(true)
    })

    it('booking: reservations выключены → недоступна', () => {
      expect(isFeatureAvailable('booking', { ...allModules, reservations: false })).toBe(false)
    })
  })

  it('неизвестный ключ → доступна (безопасный дефолт)', () => {
    expect(isFeatureAvailable('unknown', allModules)).toBe(true)
  })
})

describe('SECTION_KEYS', () => {
  it('содержит фичи с index=true', () => {
    expect(SECTION_KEYS).toContain('categoryBar')
    expect(SECTION_KEYS).toContain('hero')
    expect(SECTION_KEYS).toContain('menu')
    expect(SECTION_KEYS).toContain('banners')
    expect(SECTION_KEYS).toContain('gallery')
    expect(SECTION_KEYS).toContain('delivery')
  })

  it('НЕ содержит фичи с index=false', () => {
    expect(SECTION_KEYS).not.toContain('booking')
    expect(SECTION_KEYS).not.toContain('about')
    expect(SECTION_KEYS).not.toContain('vacancies')
  })
})

describe('NAV_PAGE_KEYS', () => {
  it('содержит фичи с nav=true', () => {
    expect(NAV_PAGE_KEYS).toContain('menu')
    expect(NAV_PAGE_KEYS).toContain('gallery')
    expect(NAV_PAGE_KEYS).toContain('delivery')
    expect(NAV_PAGE_KEYS).toContain('booking')
    expect(NAV_PAGE_KEYS).toContain('about')
  })

  it('НЕ содержит структурные секции (nav=false)', () => {
    expect(NAV_PAGE_KEYS).not.toContain('categoryBar')
    expect(NAV_PAGE_KEYS).not.toContain('hero')
    expect(NAV_PAGE_KEYS).not.toContain('vacancies')
  })
})

describe('STRUCTURAL_SECTIONS', () => {
  it('содержит categoryBar и hero', () => {
    expect(STRUCTURAL_SECTIONS).toContain('categoryBar')
    expect(STRUCTURAL_SECTIONS).toContain('hero')
  })

  it('содержит ровно 2 элемента', () => {
    expect(STRUCTURAL_SECTIONS).toHaveLength(2)
  })
})
