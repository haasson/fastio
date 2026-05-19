import { describe, it, expect } from 'vitest'
import { pickSecureFlag } from '../utils/secureRequest'

describe('pickSecureFlag', () => {
  it('https в trustedProtoHeader → true', () => {
    expect(pickSecureFlag({
      trustedProtoHeader: 'https',
      socketEncrypted: false,
    })).toBe(true)
  })

  it('http в trustedProtoHeader → false (даже если socket encrypted)', () => {
    expect(pickSecureFlag({
      trustedProtoHeader: 'http',
      socketEncrypted: true,
    })).toBe(false)
  })

  it('берёт первый proto из chain "https,http"', () => {
    expect(pickSecureFlag({
      trustedProtoHeader: 'https,http',
      socketEncrypted: false,
    })).toBe(true)
  })

  it('case-insensitive: HTTPS → true', () => {
    expect(pickSecureFlag({
      trustedProtoHeader: 'HTTPS',
      socketEncrypted: false,
    })).toBe(true)
  })

  it('тримит пробелы', () => {
    expect(pickSecureFlag({
      trustedProtoHeader: '  https  ',
      socketEncrypted: false,
    })).toBe(true)
  })

  it('фолбэк на socket.encrypted=true если заголовка нет', () => {
    expect(pickSecureFlag({
      trustedProtoHeader: undefined,
      socketEncrypted: true,
    })).toBe(true)
  })

  it('фолбэк на socket.encrypted=false если заголовка нет', () => {
    expect(pickSecureFlag({
      trustedProtoHeader: undefined,
      socketEncrypted: false,
    })).toBe(false)
  })

  it('фолбэк на socket если заголовок — пустая строка', () => {
    expect(pickSecureFlag({
      trustedProtoHeader: '',
      socketEncrypted: true,
    })).toBe(true)
  })

  it('socketEncrypted=undefined → false', () => {
    expect(pickSecureFlag({
      trustedProtoHeader: undefined,
      socketEncrypted: undefined,
    })).toBe(false)
  })
})
