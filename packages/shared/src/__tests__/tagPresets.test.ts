import { describe, it, expect } from 'vitest'
import {
  getTagColorPreset,
  getTagNamePlaceholder,
  getTagIconPresets,
  TAG_COLOR_PRESETS,
} from '../utils/tagPresets'

describe('getTagColorPreset', () => {
  it('red → точные hex значения color/background', () => {
    const preset = getTagColorPreset('red')

    expect(preset?.color).toBe('#dc2626')
    expect(preset?.background).toBe('#fee2e2')
  })

  it('неизвестный ключ → undefined', () => {
    expect(getTagColorPreset('nonexistent')).toBeUndefined()
  })

  it('indigo → точные hex значения color/background', () => {
    const preset = getTagColorPreset('indigo')

    expect(preset?.color).toBe('#4f46e5')
    expect(preset?.background).toBe('#e0e7ff')
  })

  it('все пресеты имеют key, color, background', () => {
    for (const preset of TAG_COLOR_PRESETS) {
      expect(preset.key).toBeTruthy()
      expect(preset.color).toBeTruthy()
      expect(preset.background).toBeTruthy()
    }
  })
})

describe('getTagNamePlaceholder', () => {
  it('services → "Онлайн"', () => {
    expect(getTagNamePlaceholder('services', 'food')).toBe('Онлайн')
  })

  it('retail + catalog → "Новинка"', () => {
    expect(getTagNamePlaceholder('retail', 'catalog')).toBe('Новинка')
  })

  it('retail + food → "Острое"', () => {
    expect(getTagNamePlaceholder('retail', 'food')).toBe('Острое')
  })

  it('null + food → "Острое"', () => {
    expect(getTagNamePlaceholder(null, 'food')).toBe('Острое')
  })

  it('null + catalog → "Новинка"', () => {
    expect(getTagNamePlaceholder(null, 'catalog')).toBe('Новинка')
  })
})

describe('getTagIconPresets', () => {
  it('возвращает массив иконок для food', () => {
    const icons = getTagIconPresets('retail', 'food')

    expect(Array.isArray(icons)).toBe(true)
    expect(icons.length).toBeGreaterThan(0)
  })

  it('возвращает массив иконок для catalog', () => {
    const icons = getTagIconPresets('retail', 'catalog')

    expect(icons.length).toBeGreaterThan(0)
  })

  it('возвращает массив иконок для services', () => {
    const icons = getTagIconPresets('services', 'food')

    expect(icons.length).toBeGreaterThan(0)
  })

  it('нет дубликатов (Set используется)', () => {
    const icons = getTagIconPresets('retail', 'food')
    const unique = new Set(icons)

    expect(icons.length).toBe(unique.size)
  })

  it('food и catalog возвращают разные наборы специфичных иконок', () => {
    const foodIcons = getTagIconPresets('retail', 'food')
    const catalogIcons = getTagIconPresets('retail', 'catalog')

    // Наборы должны отличаться (есть food-specific и catalog-specific иконки)
    const foodSet = new Set(foodIcons)
    const catalogSet = new Set(catalogIcons)
    const allSame = [...catalogSet].every((icon) => foodSet.has(icon))

    expect(allSame).toBe(false)
  })

  it('services и food возвращают разные наборы специфичных иконок', () => {
    const servicesIcons = getTagIconPresets('services', 'food')
    const foodIcons = getTagIconPresets('retail', 'food')

    expect(servicesIcons).not.toEqual(foodIcons)
  })
})
