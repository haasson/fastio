import { describe, it, expect } from 'vitest'
import { deepMerge } from '../utils/deepMerge'

describe('deepMerge', () => {
  describe('null / undefined overrides', () => {
    it('overrides=null → копия defaults', () => {
      const defaults = { a: 1, b: 'x' }
      const result = deepMerge(defaults, null)
      expect(result).toEqual(defaults)
      expect(result).not.toBe(defaults) // новый объект
    })

    it('overrides=undefined → копия defaults', () => {
      const defaults = { a: 1 }
      expect(deepMerge(defaults, undefined)).toEqual(defaults)
    })
  })

  describe('плоское слияние', () => {
    it('override заменяет поле', () => {
      expect(deepMerge({ a: 1, b: 2 }, { a: 99 })).toEqual({ a: 99, b: 2 })
    })

    it('поля отсутствующие в overrides — берутся из defaults', () => {
      expect(deepMerge({ a: 1, b: 2, c: 3 }, { b: 20 })).toEqual({ a: 1, b: 20, c: 3 })
    })

    it('undefined в override → поле из defaults сохраняется', () => {
      const result = deepMerge({ a: 1 }, { a: undefined })
      expect(result.a).toBe(1)
    })

    it('null в override → перезаписывает defaults (явное обнуление)', () => {
      const result = deepMerge({ a: 'hello' }, { a: null })
      expect(result.a).toBeNull()
    })
  })

  describe('глубокое слияние', () => {
    it('вложенный объект мержится рекурсивно', () => {
      const defaults = { theme: { color: 'blue', size: 'md' } }
      const result = deepMerge(defaults, { theme: { color: 'red' } })
      expect(result.theme.color).toBe('red')
      expect(result.theme.size).toBe('md') // сохранился из defaults
    })

    it('трёхуровневая вложенность', () => {
      const defaults = { a: { b: { c: 1, d: 2 } } }
      const result = deepMerge(defaults, { a: { b: { c: 99 } } })
      expect(result.a.b.c).toBe(99)
      expect(result.a.b.d).toBe(2)
    })

    it('не мутирует исходный объект', () => {
      const defaults = { theme: { color: 'blue' } }
      deepMerge(defaults, { theme: { color: 'red' } })
      expect(defaults.theme.color).toBe('blue')
    })
  })

  describe('массивы', () => {
    it('массив в override заменяет массив в defaults (не мержится)', () => {
      const defaults = { tags: ['a', 'b', 'c'] }
      const result = deepMerge(defaults, { tags: ['x'] })
      expect(result.tags).toEqual(['x'])
    })

    it('пустой массив в override → заменяет', () => {
      const defaults = { items: [1, 2, 3] }
      expect(deepMerge(defaults, { items: [] }).items).toEqual([])
    })
  })

  describe('типичный use-case — конфиг темы', () => {
    const defaultTheme = {
      colors: { primary: '#3b82f6', background: '#ffffff', text: '#111827' },
      font: { family: 'Inter', size: 16 },
      borderRadius: 8,
    }

    it('частичный override темы', () => {
      const result = deepMerge(defaultTheme, {
        colors: { primary: '#e11d48' },
        borderRadius: 4,
      })
      expect(result.colors.primary).toBe('#e11d48')
      expect(result.colors.background).toBe('#ffffff') // из defaults
      expect(result.font.family).toBe('Inter') // из defaults
      expect(result.borderRadius).toBe(4)
    })

    it('пустой override → полные defaults', () => {
      expect(deepMerge(defaultTheme, {})).toEqual(defaultTheme)
    })
  })
})
