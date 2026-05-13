import { describe, it, expect } from 'vitest'
import { pickClientIp } from '../utils/clientIp'

describe('pickClientIp', () => {
  it('возвращает socket address когда trustedHeaderValue undefined', () => {
    expect(pickClientIp({
      trustedHeaderValue: undefined,
      socketRemoteAddress: '127.0.0.1',
    })).toBe('127.0.0.1')
  })

  it('возвращает значение заголовка когда оно есть', () => {
    expect(pickClientIp({
      trustedHeaderValue: '203.0.113.42',
      socketRemoteAddress: '10.0.0.1',
    })).toBe('203.0.113.42')
  })

  it('берёт первый IP из x-forwarded-for chain', () => {
    expect(pickClientIp({
      trustedHeaderValue: '203.0.113.42, 10.0.0.1, 10.0.0.2',
      socketRemoteAddress: '10.0.0.1',
    })).toBe('203.0.113.42')
  })

  it('тримит пробелы вокруг IP в chain', () => {
    expect(pickClientIp({
      trustedHeaderValue: '  203.0.113.42 , 10.0.0.1  ',
      socketRemoteAddress: '10.0.0.1',
    })).toBe('203.0.113.42')
  })

  it('фолбэк на socket если заголовок — пустая строка', () => {
    expect(pickClientIp({
      trustedHeaderValue: '',
      socketRemoteAddress: '192.168.1.1',
    })).toBe('192.168.1.1')
  })

  it('фолбэк на socket если первый элемент chain пустой', () => {
    expect(pickClientIp({
      trustedHeaderValue: '   , 10.0.0.1',
      socketRemoteAddress: '192.168.1.1',
    })).toBe('192.168.1.1')
  })

  it('возвращает "unknown" если ни заголовка, ни socket нет', () => {
    expect(pickClientIp({
      trustedHeaderValue: undefined,
      socketRemoteAddress: undefined,
    })).toBe('unknown')
  })

  it('IPv6 заголовка проходит как есть', () => {
    expect(pickClientIp({
      trustedHeaderValue: '2001:db8::1',
      socketRemoteAddress: '10.0.0.1',
    })).toBe('2001:db8::1')
  })
})
