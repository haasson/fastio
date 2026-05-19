import { describe, it, expect } from 'vitest'
import { isLegalInfoComplete } from '../types/tenant'
import type { TenantLegalInfo } from '../types/tenant'

const makeLegalInfo = (overrides: Partial<TenantLegalInfo> = {}): TenantLegalInfo => ({
  legalName: 'ООО Тестовый',
  inn: '1234567890',
  ogrn: '1234567890123',
  legalAddress: 'г. Москва, ул. Ленина 1',
  privacyEmail: 'privacy@test.ru',
  ...overrides,
})

describe('isLegalInfoComplete', () => {
  it('null → false', () => {
    expect(isLegalInfoComplete(null)).toBe(false)
  })

  it('undefined → false', () => {
    expect(isLegalInfoComplete(undefined)).toBe(false)
  })

  it('полный объект → true', () => {
    expect(isLegalInfoComplete(makeLegalInfo())).toBe(true)
  })

  it('пустое legalName → false', () => {
    expect(isLegalInfoComplete(makeLegalInfo({ legalName: '' }))).toBe(false)
  })

  it('только пробелы в legalName → false', () => {
    expect(isLegalInfoComplete(makeLegalInfo({ legalName: '   ' }))).toBe(false)
  })

  it('пустой inn → false', () => {
    expect(isLegalInfoComplete(makeLegalInfo({ inn: '' }))).toBe(false)
  })

  it('пустой ogrn → false', () => {
    expect(isLegalInfoComplete(makeLegalInfo({ ogrn: '' }))).toBe(false)
  })

  it('пустой legalAddress → false', () => {
    expect(isLegalInfoComplete(makeLegalInfo({ legalAddress: '' }))).toBe(false)
  })

  it('пустой privacyEmail → false', () => {
    expect(isLegalInfoComplete(makeLegalInfo({ privacyEmail: '' }))).toBe(false)
  })

  it('все поля заполнены с пробелами — trim проверяется', () => {
    expect(isLegalInfoComplete(makeLegalInfo({ inn: '   ' }))).toBe(false)
  })
})
