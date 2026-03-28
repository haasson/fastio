import { describe, it, expect } from 'vitest'
import { normalizePhone, formatPhone } from '../utils/phone'

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
