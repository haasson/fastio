import { describe, it, expect } from 'vitest'
import { GA_ID_RE, YM_ID_RE } from '../utils/analyticsValidation'

describe('GA_ID_RE (Google Analytics)', () => {
  describe('валидные ID', () => {
    it('стандартный формат G-XXXXXXXX', () => {
      expect(GA_ID_RE.test('G-ABCD1234')).toBe(true)
    })

    it('нижний регистр тоже принимается (case-insensitive)', () => {
      expect(GA_ID_RE.test('G-abcd1234')).toBe(true)
    })

    it('смешанный регистр', () => {
      expect(GA_ID_RE.test('G-AbCd1234')).toBe(true)
    })

    it('минимальная длина после G- (4 символа)', () => {
      expect(GA_ID_RE.test('G-ABCD')).toBe(true)
    })

    it('максимальная длина после G- (15 символов)', () => {
      expect(GA_ID_RE.test('G-ABCDEFGHIJ12345')).toBe(true)
    })
  })

  describe('невалидные ID', () => {
    it('без префикса G-', () => {
      expect(GA_ID_RE.test('ABCD1234')).toBe(false)
    })

    it('UA- формат (старый GA) не принимается', () => {
      expect(GA_ID_RE.test('UA-12345678-1')).toBe(false)
    })

    it('слишком короткий (3 символа после G-)', () => {
      expect(GA_ID_RE.test('G-ABC')).toBe(false)
    })

    it('слишком длинный (16 символов после G-)', () => {
      expect(GA_ID_RE.test('G-ABCDEFGHIJ123456')).toBe(false)
    })

    it('пустая строка', () => {
      expect(GA_ID_RE.test('')).toBe(false)
    })

    it('спецсимволы в ID', () => {
      expect(GA_ID_RE.test('G-ABC!DEF')).toBe(false)
    })
  })
})

describe('YM_ID_RE (Яндекс.Метрика)', () => {
  describe('валидные ID', () => {
    it('5-значный ID (минимум)', () => {
      expect(YM_ID_RE.test('12345')).toBe(true)
    })

    it('8-значный ID (типичный)', () => {
      expect(YM_ID_RE.test('12345678')).toBe(true)
    })

    it('12-значный ID (максимум)', () => {
      expect(YM_ID_RE.test('123456789012')).toBe(true)
    })
  })

  describe('невалидные ID', () => {
    it('4 цифры — слишком короткий', () => {
      expect(YM_ID_RE.test('1234')).toBe(false)
    })

    it('13 цифр — слишком длинный', () => {
      expect(YM_ID_RE.test('1234567890123')).toBe(false)
    })

    it('содержит буквы', () => {
      expect(YM_ID_RE.test('1234abc')).toBe(false)
    })

    it('пустая строка', () => {
      expect(YM_ID_RE.test('')).toBe(false)
    })

    it('с дефисом', () => {
      expect(YM_ID_RE.test('1234-5678')).toBe(false)
    })
  })
})
