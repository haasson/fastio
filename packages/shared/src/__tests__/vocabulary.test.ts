import { describe, it, expect } from 'vitest'
import { selectItemVariant, selectVocabulary } from '../utils/vocabulary'

describe('selectItemVariant', () => {
  it('services → "services" независимо от menuStyle', () => {
    expect(selectItemVariant('services', 'food')).toBe('services')
    expect(selectItemVariant('services', 'catalog')).toBe('services')
  })

  it('retail + food → "food"', () => {
    expect(selectItemVariant('retail', 'food')).toBe('food')
  })

  it('retail + catalog → "catalog"', () => {
    expect(selectItemVariant('retail', 'catalog')).toBe('catalog')
  })

  it('null + food → "food" (дефолт)', () => {
    expect(selectItemVariant(null, 'food')).toBe('food')
  })

  it('null + catalog → "catalog"', () => {
    expect(selectItemVariant(null, 'catalog')).toBe('catalog')
  })
})

describe('selectVocabulary', () => {
  it('retail + food → словарь "Блюдо"/"Меню"', () => {
    const vocab = selectVocabulary('retail', 'food')

    expect(vocab.item.label).toBe('Блюдо')
    expect(vocab.menu.label).toBe('Меню')
  })

  it('retail + catalog → словарь "Товар"/"Каталог"', () => {
    const vocab = selectVocabulary('retail', 'catalog')

    expect(vocab.item.label).toBe('Товар')
    expect(vocab.menu.label).toBe('Каталог')
  })

  it('services → словарь "Услуга"/"Услуги" независимо от menuStyle', () => {
    const vocabFood = selectVocabulary('services', 'food')
    const vocabCatalog = selectVocabulary('services', 'catalog')

    expect(vocabFood.item.label).toBe('Услуга')
    expect(vocabFood.menu.label).toBe('Услуги')
    expect(vocabCatalog.item.label).toBe('Услуга')
  })

  it('food и catalog vocabulary — разные объекты', () => {
    const foodVocab = selectVocabulary('retail', 'food')
    const catalogVocab = selectVocabulary('retail', 'catalog')

    expect(foodVocab).not.toBe(catalogVocab)
  })

  it('services и food vocabulary — разные объекты', () => {
    const servicesVocab = selectVocabulary('services', 'food')
    const foodVocab = selectVocabulary('retail', 'food')

    expect(servicesVocab).not.toBe(foodVocab)
  })
})
