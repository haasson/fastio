import { describe, it, expect, vi } from 'vitest'
import { usePlanFeatures } from '../plan/usePlanFeatures'

const mockStore: { tenant: Record<string, unknown> | null } = { tenant: null }

vi.mock('~/stores/tenant', () => ({
  useTenantStore: () => mockStore,
}))

describe('usePlanFeatures', () => {
  it('план start если tenant null', () => {
    mockStore.tenant = null
    const { plan } = usePlanFeatures()

    expect(plan.value).toBe('start')
  })

  it('план start если subscription null', () => {
    mockStore.tenant = { subscription: null }
    const { plan } = usePlanFeatures()

    expect(plan.value).toBe('start')
  })

  it('план start если subscription без plan', () => {
    mockStore.tenant = { subscription: {} }
    const { plan } = usePlanFeatures()

    expect(plan.value).toBe('start')
  })

  it('корректно определяет business', () => {
    mockStore.tenant = { subscription: { plan: 'business' } }
    const { plan } = usePlanFeatures()

    expect(plan.value).toBe('business')
  })

  it('корректно определяет pro', () => {
    mockStore.tenant = { subscription: { plan: 'pro' } }
    const { plan } = usePlanFeatures()

    expect(plan.value).toBe('pro')
  })

  it('корректно определяет start', () => {
    mockStore.tenant = { subscription: { plan: 'start' } }
    const { plan } = usePlanFeatures()

    expect(plan.value).toBe('start')
  })
})
