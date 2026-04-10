import { describe, it, expect } from 'vitest'
import { filterDueTenants, validateCreateTenantInput } from '../billing'

describe('filterDueTenants', () => {
  const now = new Date('2026-04-06T12:00:00Z')

  function makeTenant(id: string, sub: { status: string; renewsAt?: string | null; trialEndsAt?: string | null }) {
    return { id, subscription: sub }
  }

  it('includes past_due tenants', () => {
    const tenants = [
      makeTenant('1', { status: 'past_due' }),
      makeTenant('2', { status: 'active', renewsAt: '2026-05-01T00:00:00Z' }),
    ]
    const result = filterDueTenants(tenants, now)

    expect(result.map((t) => t.id)).toEqual(['1'])
  })

  it('includes active tenants with renewsAt in the past', () => {
    const tenants = [
      makeTenant('1', { status: 'active', renewsAt: '2026-04-05T00:00:00Z' }),
      makeTenant('2', { status: 'active', renewsAt: '2026-04-07T00:00:00Z' }),
    ]
    const result = filterDueTenants(tenants, now)

    expect(result.map((t) => t.id)).toEqual(['1'])
  })

  it('includes active tenants with renewsAt exactly now', () => {
    const tenants = [
      makeTenant('1', { status: 'active', renewsAt: '2026-04-06T12:00:00Z' }),
    ]
    const result = filterDueTenants(tenants, now)

    expect(result.map((t) => t.id)).toEqual(['1'])
  })

  it('includes trial tenants with expired trial', () => {
    const tenants = [
      makeTenant('1', { status: 'trial', trialEndsAt: '2026-04-01T00:00:00Z' }),
      makeTenant('2', { status: 'trial', trialEndsAt: '2026-04-10T00:00:00Z' }),
    ]
    const result = filterDueTenants(tenants, now)

    expect(result.map((t) => t.id)).toEqual(['1'])
  })

  it('does not include trial tenants without trialEndsAt', () => {
    const tenants = [
      makeTenant('1', { status: 'trial' }),
    ]
    const result = filterDueTenants(tenants, now)

    expect(result).toEqual([])
  })

  it('does not include active tenants without renewsAt', () => {
    const tenants = [
      makeTenant('1', { status: 'active' }),
    ]
    const result = filterDueTenants(tenants, now)

    expect(result).toEqual([])
  })

  it('does not include suspended or cancelled tenants', () => {
    const tenants = [
      makeTenant('1', { status: 'suspended' }),
      makeTenant('2', { status: 'cancelled' }),
    ]
    const result = filterDueTenants(tenants, now)

    expect(result).toEqual([])
  })

  it('returns empty for empty input', () => {
    expect(filterDueTenants([], now)).toEqual([])
  })
})

describe('validateCreateTenantInput', () => {
  it('returns trimmed values for valid input', () => {
    const result = validateCreateTenantInput({
      name: '  My Restaurant  ',
      slug: 'my-restaurant',
      email: 'test@example.com',
    })

    expect(result).toEqual({
      name: 'My Restaurant',
      slug: 'my-restaurant',
      email: 'test@example.com',
    })
  })

  it('throws on empty name', () => {
    expect(() => validateCreateTenantInput({ name: '', slug: 'test', email: 'a@b.c' }))
      .toThrow('Заполни все поля')
  })

  it('throws on empty slug', () => {
    expect(() => validateCreateTenantInput({ name: 'Test', slug: '  ', email: 'a@b.c' }))
      .toThrow('Заполни все поля')
  })

  it('throws on empty email', () => {
    expect(() => validateCreateTenantInput({ name: 'Test', slug: 'test', email: '' }))
      .toThrow('Заполни все поля')
  })

  it('throws on missing fields', () => {
    expect(() => validateCreateTenantInput({}))
      .toThrow('Заполни все поля')
  })

  it('throws on invalid slug with uppercase', () => {
    expect(() => validateCreateTenantInput({ name: 'Test', slug: 'My-Slug', email: 'a@b.c' }))
      .toThrow('Slug может содержать')
  })

  it('throws on slug with spaces', () => {
    expect(() => validateCreateTenantInput({ name: 'Test', slug: 'my slug', email: 'a@b.c' }))
      .toThrow('Slug может содержать')
  })

  it('throws on slug with special chars', () => {
    expect(() => validateCreateTenantInput({ name: 'Test', slug: 'my_slug!', email: 'a@b.c' }))
      .toThrow('Slug может содержать')
  })

  it('allows slug with numbers and hyphens', () => {
    const result = validateCreateTenantInput({ name: 'Test', slug: 'my-restaurant-2', email: 'a@b.c' })

    expect(result.slug).toBe('my-restaurant-2')
  })

  it('throws on invalid email', () => {
    expect(() => validateCreateTenantInput({ name: 'Test', slug: 'test', email: 'not-email' }))
      .toThrow('Некорректный email')
  })

  it('throws on email without domain', () => {
    expect(() => validateCreateTenantInput({ name: 'Test', slug: 'test', email: 'user@' }))
      .toThrow('Некорректный email')
  })
})
