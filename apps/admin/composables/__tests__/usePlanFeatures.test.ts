import { describe, it, expect, vi } from 'vitest'
import { usePlanFeatures } from '../plan/usePlanFeatures'

const mockStore: { tenant: Record<string, unknown> | null } = { tenant: null }

vi.mock('~/stores/tenant', () => ({
  useTenantStore: () => mockStore,
}))

describe('usePlanFeatures', () => {
  it('план service если tenant null', () => {
    mockStore.tenant = null
    const { plan } = usePlanFeatures()

    expect(plan.value).toBe('service')
  })

  it('план service если subscription null', () => {
    mockStore.tenant = { subscription: null }
    const { plan } = usePlanFeatures()

    expect(plan.value).toBe('service')
  })

  it('план service если subscription без plan', () => {
    mockStore.tenant = { subscription: {} }
    const { plan } = usePlanFeatures()

    expect(plan.value).toBe('service')
  })

  it('корректно определяет business', () => {
    mockStore.tenant = { subscription: { plan: 'business' } }
    const { plan } = usePlanFeatures()

    expect(plan.value).toBe('business')
  })

  it('корректно определяет service', () => {
    mockStore.tenant = { subscription: { plan: 'service' } }
    const { plan } = usePlanFeatures()

    expect(plan.value).toBe('service')
  })
})
