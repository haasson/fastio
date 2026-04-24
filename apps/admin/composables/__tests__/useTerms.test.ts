import { describe, it, expect, beforeEach } from 'vitest'
import { setVocab, useTerms } from '../useTerms'
import type { BusinessType, MenuStyle } from '@fastio/shared'

const set = (businessType: BusinessType | null, menuStyle: MenuStyle = 'food') => setVocab(businessType, menuStyle)

beforeEach(() => set(null, 'food'))

describe('useTerms', () => {
  describe('menu.label', () => {
    it('retail + food → "Меню"', () => {
      set('retail', 'food')
      expect(useTerms().menu.label).toBe('Меню')
    })

    it('retail + catalog → "Каталог"', () => {
      set('retail', 'catalog')
      expect(useTerms().menu.label).toBe('Каталог')
    })

    it('services → "Услуги"', () => {
      set('services', 'food')
      expect(useTerms().menu.label).toBe('Услуги')
    })

    it('null businessType + food → "Меню"', () => {
      set(null, 'food')
      expect(useTerms().menu.label).toBe('Меню')
    })
  })

  describe('isServices', () => {
    it('services → true', () => {
      set('services')
      expect(useTerms().isServices).toBe(true)
    })

    it('retail → false', () => {
      set('retail')
      expect(useTerms().isServices).toBe(false)
    })
  })

  describe('item forms', () => {
    it('services → правильные формы услуги', () => {
      set('services')
      const { item } = useTerms()

      expect(item.nom).toBe('услуга')
      expect(item.plural.label).toBe('Услуги')
      expect(item.plural.nom).toBe('услуги')
      expect(item.plural.gen).toBe('услуг')
      expect(item.pronoun.nom).toBe('она')
    })

    it('retail + food → правильные формы блюда', () => {
      set('retail', 'food')
      const { item } = useTerms()

      expect(item.nom).toBe('блюдо')
      expect(item.plural.label).toBe('Блюда')
      expect(item.plural.nom).toBe('блюда')
      expect(item.plural.gen).toBe('блюд')
      expect(item.pronoun.nom).toBe('оно')
    })

    it('retail + catalog → правильные формы товара', () => {
      set('retail', 'catalog')
      const { item } = useTerms()

      expect(item.nom).toBe('товар')
      expect(item.plural.label).toBe('Товары')
      expect(item.plural.nom).toBe('товары')
      expect(item.plural.gen).toBe('товаров')
      expect(item.pronoun.nom).toBe('он')
    })
  })

  describe('firstItemAcc', () => {
    it('food → "первое блюдо"', () => {
      set(null, 'food')
      expect(useTerms().firstItemAcc).toBe('первое блюдо')
    })

    it('catalog → "первый товар"', () => {
      set('retail', 'catalog')
      expect(useTerms().firstItemAcc).toBe('первый товар')
    })

    it('services → "первую услугу"', () => {
      set('services')
      expect(useTerms().firstItemAcc).toBe('первую услугу')
    })
  })

  describe('reservationsLabel', () => {
    it('services → "Запись"', () => {
      set('services')
      expect(useTerms().reservationsLabel).toBe('Запись')
    })

    it('retail → "Бронирование"', () => {
      set('retail')
      expect(useTerms().reservationsLabel).toBe('Бронирование')
    })
  })
})
