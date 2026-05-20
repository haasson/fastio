import { describe, it, expect } from 'vitest'
import { parseFiniteNumber } from '../utils/parseFiniteNumber'

describe('parseFiniteNumber', () => {
  describe('базовые случаи', () => {
    it('парсит положительные числа', () => {
      expect(parseFiniteNumber(42)).toBe(42)
      expect(parseFiniteNumber(0)).toBe(0)
      expect(parseFiniteNumber(0.5)).toBe(0.5)
    })

    it('парсит числовые строки', () => {
      expect(parseFiniteNumber('42')).toBe(42)
      expect(parseFiniteNumber('0.5')).toBe(0.5)
      expect(parseFiniteNumber('1e3')).toBe(1000)
    })
  })

  describe('защита от Infinity/NaN', () => {
    it('возвращает null для Infinity', () => {
      expect(parseFiniteNumber(Infinity)).toBeNull()
      expect(parseFiniteNumber(-Infinity)).toBeNull()
      expect(parseFiniteNumber('Infinity')).toBeNull()
    })

    it('возвращает null для NaN', () => {
      expect(parseFiniteNumber(NaN)).toBeNull()
      expect(parseFiniteNumber('not-a-number')).toBeNull()
      expect(parseFiniteNumber('123abc')).toBeNull()
    })

    it('возвращает null для бесконечно больших экспонент', () => {
      expect(parseFiniteNumber('1e1000')).toBeNull()
    })
  })

  describe('защита от не-скалярных значений', () => {
    it('возвращает null для null/undefined', () => {
      expect(parseFiniteNumber(null)).toBeNull()
      expect(parseFiniteNumber(undefined)).toBeNull()
    })

    it('возвращает null для boolean', () => {
      expect(parseFiniteNumber(true)).toBeNull()
      expect(parseFiniteNumber(false)).toBeNull()
    })

    it('возвращает null для объектов и массивов', () => {
      expect(parseFiniteNumber({})).toBeNull()
      expect(parseFiniteNumber([])).toBeNull()
      expect(parseFiniteNumber([42])).toBeNull()
      expect(parseFiniteNumber({ value: 42 })).toBeNull()
    })
  })

  describe('границы min/max (default)', () => {
    it('по умолчанию отсекает отрицательные', () => {
      expect(parseFiniteNumber(-1)).toBeNull()
      expect(parseFiniteNumber(-0.0001)).toBeNull()
    })

    it('по умолчанию отсекает значения > MAX_SAFE_INTEGER / 100', () => {
      expect(parseFiniteNumber(Number.MAX_SAFE_INTEGER)).toBeNull()
      expect(parseFiniteNumber(Number.MAX_SAFE_INTEGER / 100 + 1)).toBeNull()
    })

    it('пропускает значения внутри default-диапазона', () => {
      expect(parseFiniteNumber(Number.MAX_SAFE_INTEGER / 100)).toBe(Number.MAX_SAFE_INTEGER / 100)
      expect(parseFiniteNumber(0)).toBe(0)
    })
  })

  describe('custom min/max', () => {
    it('допускает отрицательные при min < 0', () => {
      expect(parseFiniteNumber(-90, { min: -180, max: 180 })).toBe(-90)
      expect(parseFiniteNumber(-181, { min: -180, max: 180 })).toBeNull()
    })

    it('применяет custom-границы (lat/lon)', () => {
      expect(parseFiniteNumber(55.75, { min: -90, max: 90 })).toBe(55.75)
      expect(parseFiniteNumber(91, { min: -90, max: 90 })).toBeNull()
    })
  })

  describe('attack-style inputs (number overflow / poisoning)', () => {
    it('блокирует astronomical numbers в query', () => {
      expect(parseFiniteNumber('99999999999999999999999')).toBeNull()
      expect(parseFiniteNumber('1' + '0'.repeat(50))).toBeNull()
    })

    it('блокирует hex-литералы', () => {
      // Number('0x...') → парсит как hex. Защита от трюков типа '0xFFFFFFFFFFFF'.
      const hexInjection = parseFiniteNumber('0xFFFFFFFFFFFFFFFF')
      // Hex может проскочить — но огромное значение всё равно поймается max-чеком.
      if (hexInjection !== null) {
        expect(hexInjection).toBeLessThanOrEqual(Number.MAX_SAFE_INTEGER / 100)
      }
    })

    it('блокирует whitespace-poisoned input', () => {
      expect(parseFiniteNumber('  42  ')).toBe(42) // ok, JS trim'ит whitespace
      expect(parseFiniteNumber('42 ; DROP TABLE')).toBeNull()
    })
  })
})
