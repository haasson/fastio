import { describe, it, expect } from 'vitest'
import { normalizePhone, formatPhone, validateAndNormalizeRussianPhone } from '../utils/phone'

describe('normalizePhone', () => {
  it('убирает все нецифры', () => {
    expect(normalizePhone('+7 (999) 123-45-67')).toBe('79991234567')
  })

  it('заменяет ведущую 8 на 7', () => {
    expect(normalizePhone('8 999 123-45-67')).toBe('79991234567')
    expect(normalizePhone('89991234567')).toBe('79991234567')
  })

  it('уже нормализованный номер — без изменений', () => {
    expect(normalizePhone('79991234567')).toBe('79991234567')
  })

  it('короткий номер — без замены 8', () => {
    expect(normalizePhone('999')).toBe('999')
  })

  it('пустая строка — пустая строка', () => {
    expect(normalizePhone('')).toBe('')
  })
})

describe('formatPhone', () => {
  it('форматирует нормализованный номер', () => {
    expect(formatPhone('79991234567')).toBe('+7 (999) 123-45-67')
  })

  it('нормализует и форматирует номер с 8', () => {
    expect(formatPhone('89991234567')).toBe('+7 (999) 123-45-67')
  })

  it('возвращает as-is если длина не 11', () => {
    expect(formatPhone('999')).toBe('999')
    expect(formatPhone('1234567890')).toBe('1234567890')
  })

  it('возвращает as-is если пустая строка', () => {
    expect(formatPhone('')).toBe('')
  })
})

describe('validateAndNormalizeRussianPhone', () => {
  it('11 цифр начиная с 7 — возвращает как есть', () => {
    expect(validateAndNormalizeRussianPhone('79991234567')).toBe('79991234567')
  })

  it('11 цифр начиная с 8 — нормализует через 7', () => {
    expect(validateAndNormalizeRussianPhone('89991234567')).toBe('79991234567')
  })

  it('+7 с маской — возвращает 11 цифр', () => {
    expect(validateAndNormalizeRussianPhone('+7 (999) 123-45-67')).toBe('79991234567')
  })

  it('10 цифр без префикса — добавляет 7', () => {
    expect(validateAndNormalizeRussianPhone('9991234567')).toBe('79991234567')
  })

  it('10 цифр начиная с 8 — НЕ принимает (после normalize даёт 10 цифр с 7-префиксом, что выглядит как невалидный 77-номер)', () => {
    // '8123456789' (10 цифр) → normalize → '7123456789' (10 цифр).
    // Без guard'а получили бы '77123456789' — невалидный РФ-номер.
    expect(validateAndNormalizeRussianPhone('8123456789')).toBeNull()
  })

  it('число не той длины — null', () => {
    expect(validateAndNormalizeRussianPhone('123')).toBeNull()
    expect(validateAndNormalizeRussianPhone('123456789012')).toBeNull()
  })

  it('пустая строка — null', () => {
    expect(validateAndNormalizeRussianPhone('')).toBeNull()
  })
})
