// OPS-03: Unit tests for terms page gate — isLegalInfoComplete
// Verifies the gate function used by /terms to decide whether to render
// the offer sections or the SfEmptyState fallback.
// Import uses @fastio/shared (not ~/...) because vitest.config.ts line 14
// binds the '~' alias to apps/admin, not apps/storefront.
import { describe, it, expect } from 'vitest'
import { isLegalInfoComplete } from '@fastio/shared'
import type { TenantLegalInfo } from '@fastio/shared'

const completeLegalInfo: TenantLegalInfo = {
  legalName: 'ООО Тест',
  inn: '1234567890',
  ogrn: '1234567890123',
  legalAddress: 'г. Москва, ул. Тестовая, д. 1',
  privacyEmail: 'privacy@test.ru',
}

describe('terms page gate — isLegalInfoComplete', () => {
  it('returns true when all fields are non-empty', () => {
    expect(isLegalInfoComplete(completeLegalInfo)).toBe(true)
  })

  it('returns false when legalInfo is null', () => {
    expect(isLegalInfoComplete(null)).toBe(false)
  })

  it('returns false when legalInfo is undefined', () => {
    expect(isLegalInfoComplete(undefined)).toBe(false)
  })

  it('returns false when inn is empty string', () => {
    expect(isLegalInfoComplete({ ...completeLegalInfo, inn: '' })).toBe(false)
  })

  it('returns false when ogrn is whitespace-only', () => {
    expect(isLegalInfoComplete({ ...completeLegalInfo, ogrn: '   ' })).toBe(false)
  })

  it('returns false when privacyEmail is empty string', () => {
    expect(isLegalInfoComplete({ ...completeLegalInfo, privacyEmail: '' })).toBe(false)
  })
})
