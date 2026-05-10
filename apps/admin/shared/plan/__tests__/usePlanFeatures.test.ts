import { describe, it, expect, vi } from 'vitest'
import { usePlanFeatures } from '../usePlanFeatures'

const mockStore: { tenant: Record<string, unknown> | null } = { tenant: null }

vi.mock('~/shared/stores/tenant', () => ({
  useTenantStore: () => mockStore,
}))

describe('usePlanFeatures', () => {
  it('план showcase если subscription null', () => {
    mockStore.tenant = { subscription: null }
    const { plan } = usePlanFeatures()

    expect(plan.value).toBe('showcase')
  })

  it('план showcase если subscription без plan', () => {
    mockStore.tenant = { subscription: {} }
    const { plan } = usePlanFeatures()

    expect(plan.value).toBe('showcase')
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

  it('корректно определяет showcase', () => {
    mockStore.tenant = { subscription: { plan: 'showcase' } }
    const { plan } = usePlanFeatures()

    expect(plan.value).toBe('showcase')
  })
})
